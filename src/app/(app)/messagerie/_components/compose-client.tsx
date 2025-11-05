"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type Dispatch,
  type KeyboardEvent,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Paperclip, UploadCloud, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  extractPlaceholders,
  fillPlaceholders,
} from "@/lib/messaging/placeholders";
import {
  sendEmailAction,
  type ActionResult,
} from "@/app/(app)/messagerie/actions";
import {
  formatRecipientAddresses,
  mergeRecipientLists,
  parseRecipientHeader,
  splitRecipientInput,
  type RecipientDraft,
} from "@/lib/messaging/recipients";
import type { SavedResponse } from "@/lib/messaging/saved-responses";
import {
  appendMailboxMessages,
  updateMailboxMetadata,
} from "@/app/(app)/messagerie/_state/mailbox-store";
import type { SentMailboxAppendResult } from "@/server/messaging";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_ATTACHMENT_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/json",
  "text/plain",
]);
const ALLOWED_ATTACHMENT_PREFIXES = ["image/", "audio/"];

function isAllowedAttachmentType(mime: string | undefined | null): boolean {
  if (!mime) return true;
  if (ALLOWED_ATTACHMENT_TYPES.has(mime)) return true;
  return ALLOWED_ATTACHMENT_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 ko";
  }
  const units = ["octets", "ko", "Mo", "Go"] as const;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;
  const display = exponent === 0 ? value : value.toFixed(1);
  return `${display} ${units[exponent]}`;
}

type ComposeInitialDraft = {
  to?: RecipientDraft[];
  cc?: RecipientDraft[];
  bcc?: RecipientDraft[];
  subject?: string;
  body?: string;
  quotedHtml?: string;
  quotedText?: string;
};

type RecipientFieldState = {
  input: string;
  recipients: RecipientDraft[];
};

function cloneRecipients(
  recipients?: RecipientDraft[] | null
): RecipientDraft[] {
  return recipients ? recipients.map((recipient) => ({ ...recipient })) : [];
}

function createRecipientFieldState(
  recipients?: RecipientDraft[] | null
): RecipientFieldState {
  const cloned = cloneRecipients(recipients);
  return {
    input: "",
    recipients: cloned,
  };
}

function deriveRecipientsFromInput(
  rawValue: string,
  previous: RecipientDraft[],
  fallback: RecipientDraft[]
): RecipientDraft[] {
  const tokens = splitRecipientInput(rawValue);
  if (tokens.length === 0) {
    return [];
  }

  const lookup = new Map<string, RecipientDraft>();
  const register = (entry: RecipientDraft) => {
    const emailKey = entry.address.trim().toLowerCase();
    if (emailKey && !lookup.has(emailKey)) {
      lookup.set(emailKey, entry);
    }
    const displayKey = entry.display.trim().toLowerCase();
    if (displayKey && !lookup.has(displayKey)) {
      lookup.set(displayKey, entry);
    }
  };

  previous.forEach(register);
  fallback.forEach(register);

  const next: RecipientDraft[] = [];
  for (const token of tokens) {
    const parsed = parseRecipientHeader(token);
    const emailKey = parsed.address.trim().toLowerCase();
    const displayKey = parsed.display.trim().toLowerCase();
    const existing =
      (emailKey && lookup.get(emailKey)) ||
      (displayKey && lookup.get(displayKey));
    if (existing) {
      next.push(existing);
      continue;
    }
    const normalized: RecipientDraft = {
      display: parsed.display.trim() || parsed.address.trim(),
      address: parsed.address.trim() || parsed.display.trim(),
    };
    next.push(normalized);
    register(normalized);
  }

  return next;
}

type ComposeClientProps = {
  fromEmail: string | null;
  senderName: string;
  smtpConfigured: boolean;
  initialDraft?: ComposeInitialDraft | null;
  savedResponses: SavedResponse[];
  companyPlaceholders?: Record<string, string | null | undefined>;
};

type EditorMode = "plain" | "html" | "preview";

const EDITOR_TABS: Array<{ key: EditorMode; label: string }> = [
  { key: "plain", label: "Texte" },
  { key: "html", label: "HTML" },
  { key: "preview", label: "Aperçu" },
];

const COMPANY_PLACEHOLDER_KEYS = [
  "company_name",
  "company_email",
  "company_phone",
  "company_address",
] as const;

export function ComposeClient({
  fromEmail,
  senderName,
  smtpConfigured,
  initialDraft,
  savedResponses,
  companyPlaceholders,
}: ComposeClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const quotedHtml = useMemo(
    () => initialDraft?.quotedHtml ?? "",
    [initialDraft]
  );
  const quotedText = useMemo(
    () => initialDraft?.quotedText ?? "",
    [initialDraft]
  );

  const [toField, setToField] = useState<RecipientFieldState>(() =>
    createRecipientFieldState(initialDraft?.to)
  );
  const [ccField, setCcField] = useState<RecipientFieldState>(() =>
    createRecipientFieldState(initialDraft?.cc)
  );
  const [bccField, setBccField] = useState<RecipientFieldState>(() =>
    createRecipientFieldState(initialDraft?.bcc)
  );
  const [subject, setSubject] = useState(initialDraft?.subject ?? "");
  const [plainBody, setPlainBody] = useState(initialDraft?.body ?? "");
  const [htmlBody, setHtmlBody] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("plain");
  const [selectedSavedResponseId, setSelectedSavedResponseId] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const toInputRef = useRef<HTMLInputElement | null>(null);
  const ccInputRef = useRef<HTMLInputElement | null>(null);
  const bccInputRef = useRef<HTMLInputElement | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [placeholderValues, setPlaceholderValues] = useState<
    Record<string, string>
  >({});
  const [activePlaceholders, setActivePlaceholders] = useState<string[]>([]);
  const [showPlaceholderPanel, setShowPlaceholderPanel] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{
    id: string;
    format: SavedResponse["format"];
    content: string;
  } | null>(null);
  const companyPlaceholderInfo = useMemo(() => {
    const map = new Map<
      string,
      {
        value: string;
        hasValue: boolean;
      }
    >();
    const baseEntries: Array<[string, string | null | undefined]> = [
      ...COMPANY_PLACEHOLDER_KEYS.map((key) => [
        key,
        companyPlaceholders?.[key],
      ]),
      ...Object.entries(companyPlaceholders ?? {}),
    ];
    for (const [rawKey, rawValue] of baseEntries) {
      if (!rawKey) {
        continue;
      }
      const normalizedKey = rawKey.trim().toLowerCase();
      if (!normalizedKey.length) {
        continue;
      }
      if (map.has(normalizedKey) && map.get(normalizedKey)?.hasValue) {
        continue;
      }
      let value = "";
      if (typeof rawValue === "string") {
        value = rawValue.trim();
      } else if (rawValue != null) {
        value = String(rawValue).trim();
      }
      map.set(normalizedKey, { value, hasValue: value.length > 0 });
    }
    return map;
  }, [companyPlaceholders]);

  const initialDraftRef = useRef(initialDraft ?? null);
  const initialToRef = useRef<RecipientDraft[]>(
    cloneRecipients(initialDraft?.to)
  );
  const initialCcRef = useRef<RecipientDraft[]>(
    cloneRecipients(initialDraft?.cc)
  );
  const initialBccRef = useRef<RecipientDraft[]>(
    cloneRecipients(initialDraft?.bcc)
  );

  useEffect(() => {
    if (initialDraftRef.current === initialDraft) {
      return;
    }
    initialDraftRef.current = initialDraft ?? null;
    initialToRef.current = cloneRecipients(initialDraft?.to);
    initialCcRef.current = cloneRecipients(initialDraft?.cc);
    initialBccRef.current = cloneRecipients(initialDraft?.bcc);

    const nextTo = createRecipientFieldState(initialDraft?.to);
    const nextCc = createRecipientFieldState(initialDraft?.cc);
    const nextBcc = createRecipientFieldState(initialDraft?.bcc);
    const nextSubject = initialDraft?.subject ?? "";
    const nextBody = initialDraft?.body ?? "";

    queueMicrotask(() => {
      setToField(nextTo);
      setCcField(nextCc);
      setBccField(nextBcc);
      setSubject(nextSubject);
      setPlainBody(nextBody);
      setHtmlBody("");
      setEditorMode("plain");
      setSelectedSavedResponseId("");
    });
  }, [initialDraft]);

  const renderPlainPreview = useCallback((value: string) => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;")
      .replace(/\n/g, "<br />");
  }, []);

  const previewHtml = useMemo(() => {
    const htmlTrimmed = htmlBody.trim();
    if (htmlTrimmed.length > 0) {
      return htmlTrimmed;
    }
    if (!plainBody.trim().length) {
      return '<p style="color:#94a3b8;font-style:italic;">Aucun contenu à prévisualiser.</p>';
    }
    return renderPlainPreview(plainBody);
  }, [htmlBody, plainBody, renderPlainPreview]);

  const insertPlainResponse = useCallback((content: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) {
      setPlainBody((current) =>
        current.length ? `${current}\n\n${content}` : content
      );
      setEditorMode("plain");
      return;
    }
    const fallbackLength = textarea.value.length;
    const selectionStart = textarea.selectionStart ?? fallbackLength;
    const selectionEnd = textarea.selectionEnd ?? fallbackLength;
    setPlainBody((current) => {
      const before = current.slice(0, selectionStart);
      const after = current.slice(selectionEnd);
      return `${before}${content}${after}`;
    });
    queueMicrotask(() => {
      textarea.focus();
      const cursor = selectionStart + content.length;
      textarea.setSelectionRange(cursor, cursor);
    });
    setEditorMode("plain");
  }, []);

  const applyTemplateWithValues = useCallback(
    (
      template: { format: SavedResponse["format"]; content: string },
      values: Record<string, string>
    ) => {
      const resolved = fillPlaceholders(template.content, values);
      if (template.format === "HTML") {
        setHtmlBody(resolved);
        setEditorMode("preview");
        queueMicrotask(() => {
          const textarea = htmlTextareaRef.current;
          if (textarea) {
            const cursor = resolved.length;
            textarea.focus();
            textarea.setSelectionRange(cursor, cursor);
          }
        });
        addToast({
          variant: "success",
          title: "Modèle HTML inséré dans l'éditeur.",
        });
      } else {
        insertPlainResponse(resolved);
        setHtmlBody("");
        addToast({
          variant: "success",
          title: "Réponse insérée dans le corps du message.",
        });
      }
    },
    [addToast, insertPlainResponse]
  );

  const handlePlaceholderSubmit = useCallback(() => {
    if (!pendingTemplate) {
      setShowPlaceholderPanel(false);
      return;
    }
    const values = activePlaceholders.reduce<Record<string, string>>(
      (acc, name) => {
        const value = placeholderValues[name] ?? "";
        if (value.trim().length > 0) {
          acc[name] = value;
        }
        return acc;
      },
      {}
    );
    applyTemplateWithValues(pendingTemplate, values);
    setShowPlaceholderPanel(false);
    setPendingTemplate(null);
    setPlaceholderValues({});
    setActivePlaceholders([]);
    setSelectedSavedResponseId("");
  }, [
    activePlaceholders,
    applyTemplateWithValues,
    pendingTemplate,
    placeholderValues,
    setSelectedSavedResponseId,
  ]);

  const handlePlaceholderCancel = useCallback(() => {
    setShowPlaceholderPanel(false);
    setPendingTemplate(null);
    setPlaceholderValues({});
    setActivePlaceholders([]);
    setSelectedSavedResponseId("");
  }, []);

  const handleSavedResponseSelection = useCallback(
    (responseId: string) => {
      if (!responseId) {
        return;
      }
      const response = savedResponses.find((item) => item.id === responseId);
      if (!response) {
        setSelectedSavedResponseId("");
        return;
      }

      const placeholders = extractPlaceholders(response.content);
      if (placeholders.length === 0) {
        applyTemplateWithValues(
          { format: response.format, content: response.content },
          {}
        );
        setSelectedSavedResponseId("");
        return;
      }

      const defaultValues: Record<string, string> = {};
      const unresolved: string[] = [];
      const missingCompany: string[] = [];

      for (const placeholder of placeholders) {
        const trimmedName = placeholder.trim();
        const normalizedName = trimmedName.toLowerCase();
        const previousValue = placeholderValues[trimmedName] ?? "";
        const companyValue = companyPlaceholderInfo.get(normalizedName);

        if (companyValue) {
          if (companyValue.hasValue) {
            defaultValues[trimmedName] = companyValue.value;
            continue;
          }
          if (previousValue.trim().length > 0) {
            defaultValues[trimmedName] = previousValue;
          } else {
            missingCompany.push(trimmedName);
            unresolved.push(trimmedName);
            defaultValues[trimmedName] = "";
          }
          continue;
        }

        if (previousValue.trim().length > 0) {
          defaultValues[trimmedName] = previousValue;
        } else {
          unresolved.push(trimmedName);
          defaultValues[trimmedName] = "";
        }
      }

      if (missingCompany.length > 0) {
        addToast({
          variant: "warning",
          title: "Information entreprise manquante dans les paramètres.",
        });
      }

      if (unresolved.length === 0) {
        const resolvedValues = Object.fromEntries(
          Object.entries(defaultValues).filter(
            ([, value]) => value.trim().length > 0
          )
        );
        applyTemplateWithValues(
          { format: response.format, content: response.content },
          resolvedValues
        );
        setSelectedSavedResponseId("");
        setPlaceholderValues({});
        setActivePlaceholders([]);
        setPendingTemplate(null);
        setShowPlaceholderPanel(false);
        return;
      }

      setPendingTemplate({
        id: response.id,
        format: response.format,
        content: response.content,
      });
      setActivePlaceholders(placeholders);
      setPlaceholderValues(defaultValues);
      setShowPlaceholderPanel(true);
    },
    [
      addToast,
      applyTemplateWithValues,
      companyPlaceholderInfo,
      placeholderValues,
      savedResponses,
    ]
  );

  const shouldShowPlaceholderPanel =
    showPlaceholderPanel && activePlaceholders.length > 0;

  const senderDisplay = useMemo(() => {
    const email = fromEmail ?? "non configuré";
    const name = senderName.trim();
    return name ? `${name} <${email}>` : email;
  }, [fromEmail, senderName]);

  const hasPrimaryRecipient = useMemo(() => {
    return formatRecipientAddresses(toField.recipients).trim().length > 0;
  }, [toField.recipients]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files ?? []);
      if (incoming.length === 0) return;

      setAttachments((current) => {
        const existingFingerprints = new Set(
          current.map((file) => `${file.name}__${file.size}`)
        );
        const next = [...current];

        for (const file of incoming) {
          if (file.size > MAX_ATTACHMENT_SIZE) {
            addToast({
              variant: "error",
              title: "Pièce jointe trop volumineuse.",
            });
            continue;
          }
          if (!isAllowedAttachmentType(file.type)) {
            addToast({
              variant: "error",
              title: "Type de fichier non supporté.",
            });
            continue;
          }
          const fingerprint = `${file.name}__${file.size}`;
          if (existingFingerprints.has(fingerprint)) {
            continue;
          }
          existingFingerprints.add(fingerprint);
          next.push(file);
        }

        return next;
      });
    },
    [addToast]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        addFiles(event.target.files);
        event.target.value = "";
      }
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.dataTransfer?.files) {
        addFiles(event.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    []
  );

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((current) => current.filter((_, idx) => idx !== index));
  }, []);

  const commitRecipientInput = useCallback(
    (
      rawValue: string,
      setField: Dispatch<SetStateAction<RecipientFieldState>>,
      fallback: MutableRefObject<RecipientDraft[]>
    ) => {
      const replaced = rawValue.replace(/\n/g, ",");
      const trimmed = replaced.trim();
      setField((prev) => {
        if (trimmed.length === 0) {
          return prev.input.length > 0 ? { ...prev, input: "" } : prev;
        }
        const additions = deriveRecipientsFromInput(
          replaced,
          prev.recipients,
          fallback.current
        );
        if (additions.length === 0) {
          return {
            input: "",
            recipients: prev.recipients,
          };
        }
        const merged = mergeRecipientLists(prev.recipients, additions);
        return {
          input: "",
          recipients: merged,
        };
      });
    },
    []
  );

  const handleRecipientInputChange = useCallback(
    (
      value: string,
      setField: Dispatch<SetStateAction<RecipientFieldState>>,
      fallback: MutableRefObject<RecipientDraft[]>
    ) => {
      const replaced = value.replace(/\n/g, ",");
      const tokens = splitRecipientInput(replaced);
      const shouldCommit = tokens.length > 1 || /[;,]\s*$/.test(replaced);
      if (shouldCommit) {
        commitRecipientInput(replaced, setField, fallback);
        return;
      }
      setField((prev) => ({
        ...prev,
        input: replaced,
      }));
    },
    [commitRecipientInput]
  );

  const handleRecipientKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLInputElement>,
      fieldState: RecipientFieldState,
      setField: Dispatch<SetStateAction<RecipientFieldState>>,
      fallback: MutableRefObject<RecipientDraft[]>
    ) => {
      if (event.key === "Tab") {
        if (fieldState.input.trim().length > 0) {
          commitRecipientInput(fieldState.input, setField, fallback);
        }
        return;
      }
      if (event.key === "Enter" || event.key === "," || event.key === ";") {
        event.preventDefault();
        commitRecipientInput(fieldState.input, setField, fallback);
        return;
      }
      if (event.key === "Backspace" && fieldState.input.length === 0) {
        setField((prev) => {
          if (prev.recipients.length === 0) {
            return prev;
          }
          const nextRecipients = prev.recipients.slice(0, -1);
          return {
            ...prev,
            recipients: nextRecipients,
          };
        });
      }
    },
    [commitRecipientInput]
  );

  const handleRecipientPaste = useCallback(
    (
      event: ClipboardEvent<HTMLInputElement>,
      fieldState: RecipientFieldState,
      setField: Dispatch<SetStateAction<RecipientFieldState>>,
      fallback: MutableRefObject<RecipientDraft[]>
    ) => {
      event.preventDefault();
      const pasted = event.clipboardData?.getData("text") ?? "";
      const combined = `${fieldState.input}${pasted}`;
      commitRecipientInput(combined, setField, fallback);
    },
    [commitRecipientInput]
  );

  const handleRecipientRemove = useCallback(
    (
      index: number,
      setField: Dispatch<SetStateAction<RecipientFieldState>>
    ) => {
      setField((prev) => {
        if (index < 0 || index >= prev.recipients.length) {
          return prev;
        }
        const nextRecipients = prev.recipients.filter(
          (_, idx) => idx !== index
        );
        return {
          ...prev,
          recipients: nextRecipients,
        };
      });
    },
    []
  );

  const handleToInputChange = useCallback(
    (value: string) => {
      handleRecipientInputChange(value, setToField, initialToRef);
    },
    [handleRecipientInputChange]
  );

  const handleCcInputChange = useCallback(
    (value: string) => {
      handleRecipientInputChange(value, setCcField, initialCcRef);
    },
    [handleRecipientInputChange]
  );

  const handleBccInputChange = useCallback(
    (value: string) => {
      handleRecipientInputChange(value, setBccField, initialBccRef);
    },
    [handleRecipientInputChange]
  );

  async function safeSubmit(
    formData: FormData
  ): Promise<ActionResult<SentMailboxAppendResult> | null> {
    try {
      return await sendEmailAction(formData);
    } catch (error) {
      console.error("Erreur réseau lors de l'envoi :", error);
      addToast({
        variant: "error",
        title: "Erreur réseau.",
      });
      return null;
    }
  }

  const resetToInitialDraft = useCallback(() => {
    setToField(createRecipientFieldState(initialToRef.current));
    setCcField(createRecipientFieldState(initialCcRef.current));
    setBccField(createRecipientFieldState(initialBccRef.current));
    const draft = initialDraftRef.current;
    setSubject(draft?.subject ?? "");
    setPlainBody(draft?.body ?? "");
    setHtmlBody("");
    setEditorMode("plain");
    setSelectedSavedResponseId("");
    setAttachments([]);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!smtpConfigured) {
      addToast({
        variant: "warning",
        title: "Configurez votre SMTP pour envoyer un message.",
      });
      return;
    }

    const pendingToInput = toField.input;
    const pendingCcInput = ccField.input;
    const pendingBccInput = bccField.input;

    if (pendingToInput.trim().length > 0) {
      commitRecipientInput(pendingToInput, setToField, initialToRef);
    }
    if (pendingCcInput.trim().length > 0) {
      commitRecipientInput(pendingCcInput, setCcField, initialCcRef);
    }
    if (pendingBccInput.trim().length > 0) {
      commitRecipientInput(pendingBccInput, setBccField, initialBccRef);
    }

    const resolvedToRecipients =
      pendingToInput.trim().length > 0
        ? mergeRecipientLists(
            toField.recipients,
            deriveRecipientsFromInput(
              pendingToInput,
              toField.recipients,
              initialToRef.current
            )
          )
        : toField.recipients;

    const resolvedCcRecipients =
      pendingCcInput.trim().length > 0
        ? mergeRecipientLists(
            ccField.recipients,
            deriveRecipientsFromInput(
              pendingCcInput,
              ccField.recipients,
              initialCcRef.current
            )
          )
        : ccField.recipients;

    const resolvedBccRecipients =
      pendingBccInput.trim().length > 0
        ? mergeRecipientLists(
            bccField.recipients,
            deriveRecipientsFromInput(
              pendingBccInput,
              bccField.recipients,
              initialBccRef.current
            )
          )
        : bccField.recipients;

    const toAddresses = formatRecipientAddresses(resolvedToRecipients);
    const ccAddresses = formatRecipientAddresses(resolvedCcRecipients);
    const bccAddresses = formatRecipientAddresses(resolvedBccRecipients);

    const htmlActive =
      (editorMode === "html" || editorMode === "preview") &&
      htmlBody.trim().length > 0;

    const formData = new FormData();
    formData.append("to", toAddresses);
    formData.append("cc", ccAddresses);
    formData.append("bcc", bccAddresses);
    formData.append("subject", subject);
    formData.append("body", plainBody);
    formData.append("bodyHtml", htmlBody);
    formData.append("bodyFormat", htmlActive ? "html" : "plain");
    formData.append("quotedHtml", quotedHtml);
    formData.append("quotedText", quotedText);
    attachments.forEach((file) => {
      formData.append("attachments", file);
    });

    setSending(true);
    const result = await safeSubmit(formData);
    setSending(false);

    if (!result) {
      return;
    }

    if (result.success) {
      if (result.data?.message) {
        appendMailboxMessages("sent", [result.data.message], {
          totalMessages:
            typeof result.data.totalMessages === "number"
              ? result.data.totalMessages
              : undefined,
          lastSync: Date.now(),
        });
      } else if (result.data && typeof result.data.totalMessages === "number") {
        updateMailboxMetadata("sent", {
          totalMessages: result.data.totalMessages,
          lastSync: Date.now(),
        });
      }
      resetToInitialDraft();
      addToast({
        variant: "success",
        title: result.message ?? "Message envoyé.",
      });
      router.push("/messagerie/envoyes");
    } else {
      addToast({
        variant: "error",
        title: result.message,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Composer un nouveau message
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Rédigez votre e-mail, nous gérons l&apos;envoi via vos paramètres
          SMTP.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Expéditeur :
          </span>{" "}
          {senderDisplay}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="compose-to"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Destinataires
              </label>
              <div
                className="flex min-h-[2.75rem] w-full flex-wrap items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                onMouseDown={(event) => {
                  event.preventDefault();
                  toInputRef.current?.focus();
                }}
              >
                {toField.recipients.map((recipient, index) => (
                  <span
                    key={`${recipient.address || recipient.display}-${index}`}
                    className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-100"
                  >
                    <span>{recipient.display}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-blue-700 transition hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-100 dark:hover:bg-blue-500/30"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRecipientRemove(index, setToField);
                      }}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">
                        Supprimer {recipient.display}
                      </span>
                    </button>
                  </span>
                ))}
                <input
                  ref={toInputRef}
                  id="compose-to"
                  value={toField.input}
                  onChange={(event) => handleToInputChange(event.target.value)}
                  onKeyDown={(event) =>
                    handleRecipientKeyDown(
                      event,
                      toField,
                      setToField,
                      initialToRef
                    )
                  }
                  onPaste={(event) =>
                    handleRecipientPaste(
                      event,
                      toField,
                      setToField,
                      initialToRef
                    )
                  }
                  onBlur={() =>
                    commitRecipientInput(
                      toField.input,
                      setToField,
                      initialToRef
                    )
                  }
                  placeholder={
                    toField.recipients.length === 0 ? "contact@example.com" : ""
                  }
                  autoComplete="off"
                  className="flex-1 min-w-[160px] border-none bg-transparent px-1 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="compose-cc"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Cc
              </label>
              <div
                className="flex min-h-[2.75rem] w-full flex-wrap items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                onMouseDown={(event) => {
                  event.preventDefault();
                  ccInputRef.current?.focus();
                }}
              >
                {ccField.recipients.map((recipient, index) => (
                  <span
                    key={`${recipient.address || recipient.display}-${index}`}
                    className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-100"
                  >
                    <span>{recipient.display}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-blue-700 transition hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-100 dark:hover:bg-blue-500/30"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRecipientRemove(index, setCcField);
                      }}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">
                        Supprimer {recipient.display}
                      </span>
                    </button>
                  </span>
                ))}
                <input
                  ref={ccInputRef}
                  id="compose-cc"
                  value={ccField.input}
                  onChange={(event) => handleCcInputChange(event.target.value)}
                  onKeyDown={(event) =>
                    handleRecipientKeyDown(
                      event,
                      ccField,
                      setCcField,
                      initialCcRef
                    )
                  }
                  onPaste={(event) =>
                    handleRecipientPaste(
                      event,
                      ccField,
                      setCcField,
                      initialCcRef
                    )
                  }
                  onBlur={() =>
                    commitRecipientInput(
                      ccField.input,
                      setCcField,
                      initialCcRef
                    )
                  }
                  placeholder={
                    ccField.recipients.length === 0 ? "adresse@example.com" : ""
                  }
                  autoComplete="off"
                  className="flex-1 min-w-[140px] border-none bg-transparent px-1 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="compose-bcc"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Cci
              </label>
              <div
                className="flex min-h-[2.75rem] w-full flex-wrap items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                onMouseDown={(event) => {
                  event.preventDefault();
                  bccInputRef.current?.focus();
                }}
              >
                {bccField.recipients.map((recipient, index) => (
                  <span
                    key={`${recipient.address || recipient.display}-${index}`}
                    className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-100"
                  >
                    <span>{recipient.display}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-blue-700 transition hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-100 dark:hover:bg-blue-500/30"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRecipientRemove(index, setBccField);
                      }}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">
                        Supprimer {recipient.display}
                      </span>
                    </button>
                  </span>
                ))}
                <input
                  ref={bccInputRef}
                  id="compose-bcc"
                  value={bccField.input}
                  onChange={(event) => handleBccInputChange(event.target.value)}
                  onKeyDown={(event) =>
                    handleRecipientKeyDown(
                      event,
                      bccField,
                      setBccField,
                      initialBccRef
                    )
                  }
                  onPaste={(event) =>
                    handleRecipientPaste(
                      event,
                      bccField,
                      setBccField,
                      initialBccRef
                    )
                  }
                  onBlur={() =>
                    commitRecipientInput(
                      bccField.input,
                      setBccField,
                      initialBccRef
                    )
                  }
                  placeholder={
                    bccField.recipients.length === 0
                      ? "adresse@example.com"
                      : ""
                  }
                  autoComplete="off"
                  className="flex-1 min-w-[140px] border-none bg-transparent px-1 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="compose-subject"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Sujet
            </label>
            <Input
              id="compose-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Sujet du message"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <label
                  htmlFor="compose-body"
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Message
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Basculez entre texte, HTML et aperçu selon le type de réponse.
                </p>
              </div>
              {savedResponses.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="saved-response-select"
                    className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                  >
                    Réponses enregistrées
                  </label>
                  <Select
                    id="saved-response-select"
                    value={selectedSavedResponseId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedSavedResponseId(value);
                      handleSavedResponseSelection(value);
                    }}
                    className="h-9 min-w-[220px]"
                  >
                    <option value="">Insérer…</option>
                    {savedResponses.map((response) => (
                      <option key={response.id} value={response.id}>
                        {response.title}{" "}
                        {response.format === "HTML" ? "• HTML" : "• Texte"}
                      </option>
                    ))}
                  </Select>
                  <Link
                    href="/messagerie/parametres#saved-responses"
                    className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-300"
                  >
                    Gérer
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="inline-flex overflow-hidden rounded-md border border-zinc-200 bg-white text-xs font-semibold text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {EDITOR_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEditorMode(key)}
                  className={`px-4 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-500/60 dark:focus-visible:ring-offset-zinc-900 ${
                    editorMode === key
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {editorMode === "plain" && (
              <Textarea
                id="compose-body"
                ref={bodyTextareaRef}
                value={plainBody}
                onChange={(event) => setPlainBody(event.target.value)}
                rows={10}
                placeholder="Bonjour..."
              />
            )}
            {editorMode === "html" && (
              <Textarea
                id="compose-body-html"
                ref={htmlTextareaRef}
                value={htmlBody}
                onChange={(event) => setHtmlBody(event.target.value)}
                rows={12}
                placeholder="Collez ou saisissez votre HTML avec styles inline"
                className="font-mono"
              />
            )}
            {editorMode === "preview" && (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div
                  className="prose prose-sm max-w-none text-zinc-700 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )}
          </div>

          {shouldShowPlaceholderPanel && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-400/40 dark:bg-blue-500/10">
              <div
                className="space-y-3"
                role="group"
                aria-labelledby="placeholder-panel-title"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    event.target instanceof HTMLInputElement
                  ) {
                    event.preventDefault();
                    handlePlaceholderSubmit();
                  }
                }}
              >
                <div className="flex flex-col gap-1">
                  <h4
                    id="placeholder-panel-title"
                    className="text-sm font-semibold text-blue-700 dark:text-blue-200"
                  >
                    Variables à renseigner
                  </h4>
                  <p className="text-xs text-blue-600/80 dark:text-blue-200/80">
                    Complétez les champs ci-dessous pour personnaliser le modèle
                    avant insertion.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-blue-200/70 text-left text-xs uppercase tracking-wide text-blue-600 dark:border-blue-400/30 dark:text-blue-200">
                        <th className="px-3 py-2">Nom du champ</th>
                        <th className="px-3 py-2">Valeur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePlaceholders.map((placeholder) => (
                        <tr
                          key={placeholder}
                          className="border-b border-blue-100/60 last:border-none dark:border-blue-400/20"
                        >
                          <td className="px-3 py-2 font-medium text-blue-700 dark:text-blue-200">
                            {placeholder.replace(/_/g, " ")}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              name={placeholder}
                              value={placeholderValues[placeholder] ?? ""}
                              placeholder={`Valeur pour ${placeholder}`}
                              onChange={(event) =>
                                setPlaceholderValues((previous) => ({
                                  ...previous,
                                  [placeholder]: event.target.value,
                                }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handlePlaceholderCancel}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePlaceholderSubmit}
                  >
                    Insérer le modèle
                  </Button>
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {htmlBody.trim().length > 0
              ? "Mode HTML actif — votre mise en page est conservée."
              : "Mode texte brut — vos sauts de ligne sont convertis en paragraphes."}
          </p>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <UploadCloud className="h-6 w-6" />
              <p>Glissez-déposez vos fichiers ou</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Joindre un fichier
              </Button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Formats acceptés : images, PDF, documents, audio. Taille max :
                10 Mo par fichier.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {attachments.length > 0 ? (
            <ul className="space-y-2">
              {attachments.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-zinc-500" />
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">
                        {file.name}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs text-zinc-500 hover:text-red-500 dark:text-zinc-400"
                    onClick={() => handleRemoveAttachment(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Supprimer la pièce jointe</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {(quotedHtml || quotedText) && (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Message original
              </p>
              {quotedHtml ? (
                <div
                  className="prose prose-sm max-w-none text-zinc-700 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: quotedHtml }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                  {quotedText}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="submit"
              loading={sending}
              disabled={!smtpConfigured || sending || !hasPrimaryRecipient}
            >
              Envoyer
            </Button>
            {!smtpConfigured ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                Configurez le SMTP pour activer l&apos;envoi.
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
