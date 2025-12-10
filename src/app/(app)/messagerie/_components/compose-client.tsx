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
import type { Route } from "next";
import type { Mailbox } from "@/server/messaging";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Paperclip,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
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
  scheduleEmailAction,
  runAiReplyAction,
  runAiDraftPolishAction,
  runAiSubjectAction,
  type ActionResult,
  type AiReplyActionInput,
  type AiDraftPolishActionInput,
  type AiSubjectActionInput,
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
  quotedHeaderHtml?: string;
  quotedHeaderText?: string;
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
  replyContext?: { mailbox: Mailbox; uid: number } | null;
};

type EditorMode = "plain" | "html" | "preview";

const EDITOR_TABS: Array<{ key: EditorMode; label: string }> = [
  { key: "plain", label: "Texte" },
  { key: "html", label: "HTML" },
  { key: "preview", label: "Aperçu" },
];

type AiReplyMode = "improve_text_html" | "improve_text_only" | "correct_only";

const AI_MODE_CONFIG: Record<AiReplyMode, { label: string; description: string }> = {
  improve_text_html: {
    label: "Améliorer texte + HTML",
    description: "Réécrit le brouillon pour le rendre plus clair tout en conservant le HTML.",
  },
  improve_text_only: {
    label: "Améliorer texte uniquement",
    description: "Ajuste uniquement la version texte brut. La version HTML reste inchangée.",
  },
  correct_only: {
    label: "Corriger seulement",
    description: "Corrige orthographe et grammaire sans reformuler ni changer le ton (texte + HTML).",
  },
};

type ComposeAiMode = AiDraftPolishActionInput["intent"];

const COMPOSE_AI_MIN_WORDS = 8;

const COMPOSE_AI_CONFIG: Record<ComposeAiMode, { label: string; description: string }> = {
  correct_only: {
    label: "Corriger",
    description: "Orthographe et grammaire uniquement, sans changer le style.",
  },
  enhance: {
    label: "Corriger et améliorer",
    description: "Corrige et clarifie le ton tout en conservant le sens.",
  },
};

const SUBJECT_AI_MIN_WORDS = 8;

const COMPANY_PLACEHOLDER_KEYS = [
  "company_name",
  "company_email",
  "company_phone",
  "company_address",
] as const;

const BLOCK_LEVEL_TAGS = new Set([
  "p",
  "li",
  "ul",
  "ol",
  "td",
  "th",
  "blockquote",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "section",
  "article",
  "aside",
  "header",
  "footer",
  "div",
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function convertPlainTextToHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function renderPlainBodyAsHtml(value: string): string {
  const trimmed = value.trimEnd();
  return trimmed.length ? `<div>${convertPlainTextToHtml(trimmed)}</div>` : "";
}

function normalizePlainText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/\t+/g, " ")
    .replace(/[ \f\v]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fallbackHtmlToPlainText(source: string): string {
  return normalizePlainText(
    source
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<template[\s\S]*?<\/template>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(
        /<\/(p|div|section|article|header|footer|aside|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|blockquote|pre|h[1-6])>/gi,
        "\n"
      )
      .replace(/<[^>]+>/g, " ")
  );
}

function convertHtmlToPlainText(source: string): string {
  const trimmed = source?.trim() ?? "";
  if (!trimmed.length) {
    return "";
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallbackHtmlToPlainText(trimmed);
  }
  const container: HTMLDivElement = document.createElement("div");
  container.innerHTML = trimmed;
  container
    .querySelectorAll("style,script,noscript,template")
    .forEach((node) => {
      node.remove();
    });
  container.querySelectorAll("li").forEach((item) => {
    const firstChild: ChildNode | null = item.firstChild;
    const existingText =
      firstChild && firstChild.nodeType === Node.TEXT_NODE
        ? firstChild.textContent ?? ""
        : "";
    const normalized = existingText.replace(/^\s+/, "");
    if (!normalized.startsWith("• ")) {
      item.insertAdjacentText("afterbegin", "• ");
    }
  });
  container.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href) return;
    const trimmedHref = href.trim();
    if (!trimmedHref.length) return;
    const anchorText = (anchor.textContent ?? "").trim();
    if (anchorText.includes(trimmedHref)) {
      return;
    }
    anchor.appendChild(document.createTextNode(` (${trimmedHref})`));
  });
  const textContent = (container as Node).textContent ?? "";
  const text =
    "innerText" in container
      ? (container as HTMLElement).innerText
      : textContent;
  return normalizePlainText(text);
}

type HtmlBlueprint = {
  html: string;
  blockPaths: number[][];
};

function resolveNodeByPath(root: Node, path: number[]): Node | null {
  let current: Node | null = root;
  for (const index of path) {
    if (!current || !current.childNodes[index]) {
      return null;
    }
    current = current.childNodes[index] ?? null;
  }
  return current;
}

function splitPlainTextIntoParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment, index, all) => segment.length > 0 || index < all.length - 1);
}

function buildHtmlBlueprint(source: string): HtmlBlueprint | null {
  if (typeof document === "undefined") {
    return null;
  }
  const trimmed = source.trim();
  if (!trimmed.length) {
    return null;
  }
  const container = document.createElement("div");
  container.innerHTML = trimmed;
  container
    .querySelectorAll("style,script,noscript,template")
    .forEach((node) => node.remove());
  const blockPaths: number[][] = [];

  const collect = (node: Node, path: number[]) => {
    node.childNodes.forEach((child, index) => {
      const nextPath = [...path, index];
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        const childNodes = Array.from(element.childNodes);
        if (BLOCK_LEVEL_TAGS.has(tagName)) {
          const hasNestedBlocks = childNodes.some(
            (nested) =>
              nested.nodeType === Node.ELEMENT_NODE &&
              BLOCK_LEVEL_TAGS.has(
                (nested as HTMLElement).tagName.toLowerCase()
              )
          );
          if (!hasNestedBlocks && element.innerText.trim().length > 0) {
            blockPaths.push(nextPath);
          }
        }
        collect(child, nextPath);
      }
    });
  };

  collect(container, []);

  if (!blockPaths.length) {
    blockPaths.push([]);
  }

  return {
    html: container.innerHTML,
    blockPaths,
  };
}

function applyPlainTextToBlueprint(
  value: string,
  blueprint: HtmlBlueprint | null
): string {
  if (typeof document === "undefined") {
    return renderPlainBodyAsHtml(value);
  }
  const trimmed = value.trimEnd();
  if (!trimmed.length) {
    return "";
  }
  if (!blueprint) {
    return renderPlainBodyAsHtml(value);
  }
  const container = document.createElement("div");
  container.innerHTML = blueprint.html;
  const paragraphs = splitPlainTextIntoParagraphs(value);
  let cursor = 0;
  for (const path of blueprint.blockPaths) {
    const node = resolveNodeByPath(container, path);
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }
    const paragraph = cursor < paragraphs.length ? paragraphs[cursor]! : "";
    (node as HTMLElement).innerHTML = paragraph.length
      ? convertPlainTextToHtml(paragraph)
      : "";
    cursor += 1;
  }

  while (cursor < paragraphs.length) {
    const paragraph = paragraphs[cursor];
    if (paragraph.length) {
      const extra = container.ownerDocument?.createElement("p") ??
        document.createElement("p");
      extra.innerHTML = convertPlainTextToHtml(paragraph);
      container.appendChild(extra);
    }
    cursor += 1;
  }

  return container.innerHTML;
}

function formatDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ComposeClient({
  fromEmail,
  senderName,
  smtpConfigured,
  initialDraft,
  savedResponses,
  companyPlaceholders,
  replyContext = null,
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
  const quotedHeaderHtml = useMemo(
    () => initialDraft?.quotedHeaderHtml ?? "",
    [initialDraft]
  );
  const quotedHeaderText = useMemo(
    () => initialDraft?.quotedHeaderText ?? "",
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
  const [htmlSyncEnabled, setHtmlSyncEnabled] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("plain");
  const [selectedSavedResponseId, setSelectedSavedResponseId] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [aiMode, setAiMode] = useState<AiReplyMode>("improve_text_html");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSubjectLoading, setAiSubjectLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduledAtInput, setScheduledAtInput] = useState(() =>
    formatDateTimeLocal(new Date(Date.now() + 30 * 60 * 1000)),
  );
  const [scheduling, setScheduling] = useState(false);
  const toInputRef = useRef<HTMLInputElement | null>(null);
  const ccInputRef = useRef<HTMLInputElement | null>(null);
  const bccInputRef = useRef<HTMLInputElement | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const aiButtonWrapperRef = useRef<HTMLDivElement | null>(null);
  const contentAuthorityRef = useRef<"plain" | "html">("plain");
  const htmlBlueprintRef = useRef<HtmlBlueprint | null>(null);
  const [composeAiMenuRequested, setComposeAiMenuRequested] = useState(false);
  const [replyAiMenuRequested, setReplyAiMenuRequested] = useState(false);
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
    const mappedCompanyPlaceholders: Array<
      [string, string | null | undefined]
    > = COMPANY_PLACEHOLDER_KEYS.map(
      (key): [string, string | null | undefined] => [
        key,
        companyPlaceholders?.[key] ?? null,
      ],
    );
    const dynamicEntries: Array<[string, string | null | undefined]> = Object.entries(
      companyPlaceholders ?? {},
    ).map(
      ([entryKey, entryValue]): [string, string | null | undefined] => [
        entryKey,
        entryValue,
      ],
    );
    const baseEntries: Array<[string, string | null | undefined]> = [
      ...mappedCompanyPlaceholders,
      ...dynamicEntries,
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
  const enforceAiModeForPlain = useCallback(
    (value?: string) => {
      const content = (value ?? plainBody ?? "").trim();
      if (!content.length) {
        return;
      }
      const looksLikeHtml = /<[^>]+>/.test(content);
      if (looksLikeHtml && aiMode === "improve_text_only") {
        setAiMode("improve_text_html");
      } else if (!looksLikeHtml && aiMode === "improve_text_html") {
        setAiMode("improve_text_only");
      }
    },
    [aiMode, plainBody]
  );
  const captureHtmlBlueprint = useCallback((source: string) => {
    const trimmed = source.trim();
    if (!trimmed.length) {
      htmlBlueprintRef.current = null;
      return;
    }
    const blueprint = buildHtmlBlueprint(trimmed);
    htmlBlueprintRef.current = blueprint;
  }, []);

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
      enforceAiModeForPlain(nextBody);
      setHtmlBody("");
      captureHtmlBlueprint("");
      setHtmlSyncEnabled(false);
      contentAuthorityRef.current = "plain";
      setEditorMode("plain");
      setSelectedSavedResponseId("");
    });
  }, [initialDraft, enforceAiModeForPlain, captureHtmlBlueprint]);

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

  const insertPlainResponse = useCallback(
    (content: string) => {
      contentAuthorityRef.current = "plain";
      setHtmlSyncEnabled(false);
      setHtmlBody("");
      captureHtmlBlueprint("");
      const textarea = bodyTextareaRef.current;
      if (!textarea) {
        const nextPlain =
          plainBody.length > 0 ? `${plainBody}\n\n${content}` : content;
        setPlainBody(nextPlain);
        enforceAiModeForPlain(nextPlain);
        setEditorMode("plain");
        return;
      }
      const fallbackLength = textarea.value.length;
      const selectionStart = textarea.selectionStart ?? fallbackLength;
      const selectionEnd = textarea.selectionEnd ?? fallbackLength;
      const before = plainBody.slice(0, selectionStart);
      const after = plainBody.slice(selectionEnd);
      const nextPlain = `${before}${content}${after}`;
      setPlainBody(nextPlain);
      enforceAiModeForPlain(nextPlain);
      queueMicrotask(() => {
        textarea.focus();
        const cursor = selectionStart + content.length;
        textarea.setSelectionRange(cursor, cursor);
      });
      setEditorMode("plain");
    },
    [captureHtmlBlueprint, enforceAiModeForPlain, plainBody]
  );

  const syncPlainWithHtml = useCallback(
    (value: string, options?: { force?: boolean }) => {
      if (!options?.force && !htmlSyncEnabled) {
        return;
      }
      if (contentAuthorityRef.current !== "html") {
        return;
      }
      const nextPlain = convertHtmlToPlainText(value);
      setPlainBody(nextPlain);
      enforceAiModeForPlain(nextPlain);
    },
    [enforceAiModeForPlain, htmlSyncEnabled]
  );

  const syncHtmlWithPlain = useCallback(
    (value: string, options?: { force?: boolean }) => {
      if (!options?.force && !htmlSyncEnabled) {
        return;
      }
      if (contentAuthorityRef.current !== "plain") {
        return;
      }
      const nextHtml = applyPlainTextToBlueprint(value, htmlBlueprintRef.current);
      setHtmlBody(nextHtml);
      captureHtmlBlueprint(nextHtml);
    },
    [captureHtmlBlueprint, htmlSyncEnabled]
  );

  const handlePlainBodyChange = useCallback(
    (value: string) => {
      contentAuthorityRef.current = "plain";
      setPlainBody(value);
      enforceAiModeForPlain(value);
      syncHtmlWithPlain(value);
    },
    [enforceAiModeForPlain, syncHtmlWithPlain]
  );

  const handleHtmlBodyChange = useCallback(
    (value: string) => {
      setHtmlSyncEnabled(true);
      contentAuthorityRef.current = "html";
      setHtmlBody(value);
      captureHtmlBlueprint(value);
      syncPlainWithHtml(value, { force: true });
    },
    [captureHtmlBlueprint, syncPlainWithHtml]
  );

  const applyTemplateWithValues = useCallback(
    (
      template: { format: SavedResponse["format"]; content: string },
      values: Record<string, string>
    ) => {
      const resolved = fillPlaceholders(template.content, values);
      if (template.format === "HTML") {
        setHtmlSyncEnabled(true);
        contentAuthorityRef.current = "html";
        setHtmlBody(resolved);
        captureHtmlBlueprint(resolved);
        syncPlainWithHtml(resolved, { force: true });
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
        addToast({
          variant: "success",
          title: "Réponse insérée dans le corps du message.",
        });
      }
    },
    [addToast, captureHtmlBlueprint, insertPlainResponse, syncPlainWithHtml]
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

  const trimmedPlainBody = plainBody.trim();
  const trimmedHtmlBody = htmlBody.trim();
  const plainWordCount = useMemo(() => {
    if (!trimmedPlainBody.length) {
      return 0;
    }
    return trimmedPlainBody.split(/\s+/).filter(Boolean).length;
  }, [trimmedPlainBody]);
  const bodyWordCount = useMemo(() => {
    if (plainWordCount > 0) {
      return plainWordCount;
    }
    if (!trimmedHtmlBody.length) {
      return 0;
    }
    const fallbackPlain = convertHtmlToPlainText(trimmedHtmlBody);
    if (!fallbackPlain.trim().length) {
      return 0;
    }
    return fallbackPlain.split(/\s+/).filter(Boolean).length;
  }, [plainWordCount, trimmedHtmlBody]);

  const safeAiReply = useCallback(
    async (
      payload: AiReplyActionInput
    ): Promise<ActionResult<{ plainBody: string; htmlBody?: string }> | null> => {
      try {
        return await runAiReplyAction(payload);
      } catch (error) {
        console.error("Erreur réseau lors de l'assistant IA:", error);
        addToast({
          variant: "error",
          title: "Erreur réseau.",
        });
        return null;
      }
    },
    [addToast]
  );

  const safeAiDraftPolish = useCallback(
    async (
      intent: ComposeAiMode
    ): Promise<ActionResult<{ plainBody: string; htmlBody?: string }> | null> => {
      try {
        return await runAiDraftPolishAction({
          intent,
          plainBody,
          htmlBody,
        });
      } catch (error) {
        console.error("Erreur réseau lors de la réécriture du brouillon:", error);
        addToast({
          variant: "error",
          title: "Erreur réseau.",
        });
        return null;
      }
    },
    [addToast, plainBody, htmlBody]
  );

  const safeAiSubject = useCallback(
    async (): Promise<ActionResult<{ subject: string }> | null> => {
      try {
        return await runAiSubjectAction({
          plainBody,
          htmlBody,
        });
      } catch (error) {
        console.error("Erreur réseau lors de la génération de l'objet:", error);
        addToast({
          variant: "error",
          title: "Erreur réseau.",
        });
        return null;
      }
    },
    [addToast, plainBody, htmlBody]
  );

  const handleAiReply = useCallback(async (mode?: AiReplyMode) => {
    if (!replyContext || aiLoading) {
      return;
    }
    const nextMode = mode ?? aiMode;
    const hasExistingContent =
      trimmedPlainBody.length > 0 || trimmedHtmlBody.length > 0;
    const intent: AiReplyActionInput["intent"] = hasExistingContent
      ? nextMode
      : "generate";
    setAiLoading(true);
    const result = await safeAiReply({
      mailbox: replyContext.mailbox,
      uid: replyContext.uid,
      intent,
      currentBody: plainBody,
      currentHtmlBody: htmlBody,
      senderName,
      senderEmail: fromEmail ?? "",
    });
    setAiLoading(false);

    if (!result) {
      return;
    }

    if (!result.success || !result.data) {
      addToast({
        variant: "error",
        title: result.message || "Impossible d'utiliser l'assistant pour le moment.",
      });
      return;
    }

    const nextHtml =
      typeof result.data.htmlBody === "string" ? result.data.htmlBody : "";
    const hasHtmlResult = intent === "improve_text_only"
      ? false
      : nextHtml.trim().length > 0;

    if (intent === "improve_text_only") {
      setHtmlSyncEnabled(false);
      contentAuthorityRef.current = "plain";
      if (nextHtml.length) {
        setHtmlBody(nextHtml);
        captureHtmlBlueprint(nextHtml);
      }
      setPlainBody(result.data.plainBody);
      enforceAiModeForPlain(result.data.plainBody);
    } else {
      setHtmlSyncEnabled(hasHtmlResult);
      contentAuthorityRef.current = hasHtmlResult ? "html" : "plain";
      if (hasHtmlResult) {
        setHtmlBody(nextHtml);
        captureHtmlBlueprint(nextHtml);
        syncPlainWithHtml(nextHtml, { force: true });
      } else {
        setHtmlBody("");
        captureHtmlBlueprint("");
        setPlainBody(result.data.plainBody);
        enforceAiModeForPlain(result.data.plainBody);
      }
    }
    if (result.message) {
      addToast({
        variant: "success",
        title: result.message,
      });
    }
  }, [
    replyContext,
    aiLoading,
    plainBody,
    htmlBody,
    aiMode,
    trimmedPlainBody,
    trimmedHtmlBody,
    safeAiReply,
    senderName,
    fromEmail,
    addToast,
    syncPlainWithHtml,
    enforceAiModeForPlain,
    captureHtmlBlueprint,
  ]);

  const handleDraftAiRequest = useCallback(
    async (intent: ComposeAiMode) => {
      if (aiLoading) {
        return;
      }
      setComposeAiMenuRequested(false);
      const hasContent =
        trimmedPlainBody.length > 0 || trimmedHtmlBody.length > 0;
      if (!hasContent) {
        addToast({
          variant: "warning",
          title: "Ajoutez un contenu avant d'utiliser l'IA.",
        });
        return;
      }
      setAiLoading(true);
      const result = await safeAiDraftPolish(intent);
      setAiLoading(false);
      if (!result) {
        return;
      }
      if (!result.success || !result.data) {
        addToast({
          variant: "error",
          title:
            result.message || "Impossible d'améliorer le brouillon pour le moment.",
        });
        return;
      }
      const nextPlain = result.data.plainBody ?? "";
      const incomingHtml = result.data.htmlBody?.trim() ?? "";
      setPlainBody(nextPlain);
      enforceAiModeForPlain(nextPlain);
      const hadHtmlBefore = trimmedHtmlBody.length > 0;
      if (incomingHtml.length) {
        setHtmlSyncEnabled(true);
        contentAuthorityRef.current = "html";
        setHtmlBody(incomingHtml);
        captureHtmlBlueprint(incomingHtml);
      } else if (hadHtmlBefore) {
        setHtmlSyncEnabled(true);
        contentAuthorityRef.current = "html";
        setHtmlBody(trimmedHtmlBody);
        captureHtmlBlueprint(trimmedHtmlBody);
      } else {
        setHtmlSyncEnabled(false);
        contentAuthorityRef.current = "plain";
        setHtmlBody("");
        captureHtmlBlueprint("");
      }
      addToast({
        variant: "success",
        title: result.message || "Brouillon mis à jour.",
      });
    },
    [
      aiLoading,
      addToast,
      captureHtmlBlueprint,
      enforceAiModeForPlain,
      safeAiDraftPolish,
      trimmedHtmlBody,
      trimmedPlainBody,
    ]
  );

  const handleReplyAiRequest = useCallback(
    (mode: AiReplyMode) => {
      if (aiLoading) {
        return;
      }
      setReplyAiMenuRequested(false);
      setAiMode(mode);
      void handleAiReply(mode);
    },
    [aiLoading, handleAiReply]
  );

  const handleSubjectAiRequest = useCallback(async () => {
    if (replyContext) {
      return;
    }
    const hasContent = trimmedPlainBody.length > 0 || trimmedHtmlBody.length > 0;
    if (!hasContent) {
      addToast({
        variant: "info",
        title: "Ajoutez du contenu avant de proposer un objet.",
      });
      return;
    }
    if (bodyWordCount < SUBJECT_AI_MIN_WORDS) {
      const remaining = Math.max(SUBJECT_AI_MIN_WORDS - bodyWordCount, 0);
      addToast({
        variant: "info",
        title: `Ajoutez encore ${remaining} mot${remaining > 1 ? "s" : ""} pour générer l'objet.`,
      });
      return;
    }
    setAiSubjectLoading(true);
    const result = await safeAiSubject();
    setAiSubjectLoading(false);
    if (!result) {
      return;
    }
    if (!result.success || !result.data) {
      addToast({
        variant: "error",
        title: result.message || "Impossible de générer l'objet.",
      });
      return;
    }
    const suggestion = result.data.subject?.trim() ?? "";
    if (suggestion.length) {
      setSubject(suggestion);
      addToast({
        variant: "success",
        title: "Objet inséré.",
      });
    }
  }, [
    addToast,
    bodyWordCount,
    replyContext,
    safeAiSubject,
    setSubject,
    trimmedHtmlBody,
    trimmedPlainBody,
  ]);

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

  const hasAnyBody = trimmedPlainBody.length > 0 || trimmedHtmlBody.length > 0;
  const replyAiActionLabel = hasAnyBody
    ? AI_MODE_CONFIG[aiMode].label
    : "Générer une réponse avec l'IA";
  const aiModeDescription = AI_MODE_CONFIG[aiMode].description;
  const showReplyAiButton = Boolean(replyContext) &&
    (editorMode === "plain" || editorMode === "html");
  const showAiModeSelect = false;
  const meetsDraftAiThreshold = bodyWordCount >= COMPOSE_AI_MIN_WORDS;
  const showDraftAiButton = !replyContext && hasAnyBody &&
    (editorMode === "plain" || editorMode === "html");
  const replyHasContent = hasAnyBody;
  const showAiActionButton = showReplyAiButton || showDraftAiButton;
  const composeAiButtonLabel = "Optimiser le brouillon";
  const composeAiMenuOpen = showDraftAiButton && meetsDraftAiThreshold && composeAiMenuRequested;
  const replyAiMenuOpen = showReplyAiButton && replyHasContent && replyAiMenuRequested;
  const showSubjectAiButton = !replyContext && hasAnyBody;
  const subjectAiEnabled = showSubjectAiButton && bodyWordCount >= SUBJECT_AI_MIN_WORDS;
  const subjectAiRemaining = Math.max(SUBJECT_AI_MIN_WORDS - bodyWordCount, 0);

  useEffect(() => {
    const anyMenuOpen = composeAiMenuOpen || replyAiMenuOpen;
    if (!anyMenuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!aiButtonWrapperRef.current) {
        return;
      }
      if (aiButtonWrapperRef.current.contains(event.target as Node)) {
        return;
      }
      setComposeAiMenuRequested(false);
      setReplyAiMenuRequested(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setComposeAiMenuRequested(false);
        setReplyAiMenuRequested(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [composeAiMenuOpen, replyAiMenuOpen]);

  const aiButtonNode = showAiActionButton ? (
    <div
      ref={aiButtonWrapperRef}
      className="absolute right-3 top-3 flex flex-col items-end gap-2"
    >
      <button
        type="button"
        onClick={() => {
          if (showReplyAiButton) {
            setComposeAiMenuRequested(false);
            if (!replyHasContent) {
              void handleAiReply();
              return;
            }
            setReplyAiMenuRequested((previous) => !previous);
            return;
          }
          if (!meetsDraftAiThreshold) {
            const remaining = Math.max(COMPOSE_AI_MIN_WORDS - bodyWordCount, 0);
            addToast({
              variant: "info",
              title: `Ajoutez encore ${remaining} mot${remaining > 1 ? "s" : ""} pour activer l'IA.`,
            });
            return;
          }
          setReplyAiMenuRequested(false);
          setComposeAiMenuRequested((previous) => !previous);
        }}
        title={showReplyAiButton ? replyAiActionLabel : composeAiButtonLabel}
        aria-label={showReplyAiButton ? replyAiActionLabel : composeAiButtonLabel}
        disabled={aiLoading || (!showReplyAiButton && !meetsDraftAiThreshold)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-blue-300"
      >
        {aiLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {(showDraftAiButton && composeAiMenuOpen) || (showReplyAiButton && replyAiMenuOpen) ? (
        <div className="z-20 w-64 max-w-[280px] rounded-xl border border-zinc-200 bg-white text-left shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Assistant IA
          </div>
          <div className="flex flex-col gap-1 px-2 pb-2">
            {showReplyAiButton && replyAiMenuOpen
              ? Object.entries(AI_MODE_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleReplyAiRequest(key as AiReplyMode)}
                    disabled={aiLoading}
                    className="rounded-lg px-3 py-2 text-left text-sm text-zinc-800 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {config.label}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                      {config.description}
                    </span>
                  </button>
                ))
              : Object.entries(COMPOSE_AI_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void handleDraftAiRequest(key as ComposeAiMode)}
                    disabled={aiLoading}
                    className="rounded-lg px-3 py-2 text-left text-sm text-zinc-800 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {config.label}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                      {config.description}
                    </span>
                  </button>
                ))}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

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

  async function safeSchedule(
    formData: FormData
  ): Promise<ActionResult<{ id: string }> | null> {
    try {
      return await scheduleEmailAction(formData);
    } catch (error) {
      console.error("Erreur réseau lors de la planification:", error);
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
    enforceAiModeForPlain(draft?.body ?? "");
    setHtmlBody("");
    captureHtmlBlueprint("");
    setHtmlSyncEnabled(false);
    contentAuthorityRef.current = "plain";
    setEditorMode("plain");
    setSelectedSavedResponseId("");
    setAttachments([]);
  }, [captureHtmlBlueprint, enforceAiModeForPlain]);

  const prepareComposeFormData = useCallback((): FormData | null => {
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
    if (!toAddresses.trim().length) {
      addToast({
        variant: "error",
        title: "Ajoutez au moins un destinataire.",
      });
      return null;
    }

    const ccAddresses = formatRecipientAddresses(resolvedCcRecipients);
    const bccAddresses = formatRecipientAddresses(resolvedBccRecipients);

    const htmlActive = htmlBody.trim().length > 0;

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
    formData.append("quotedHeaderHtml", quotedHeaderHtml);
    formData.append("quotedHeaderText", quotedHeaderText);
    attachments.forEach((file) => {
      formData.append("attachments", file);
    });

    return formData;
  }, [
    addToast,
    attachments,
    bccField,
    ccField,
    commitRecipientInput,
    deriveRecipientsFromInput,
    editorMode,
    htmlBody,
    initialBccRef,
    initialCcRef,
    initialToRef,
    formatRecipientAddresses,
    mergeRecipientLists,
    plainBody,
    quotedHtml,
    quotedText,
    quotedHeaderHtml,
    quotedHeaderText,
    subject,
    setBccField,
    setCcField,
    setToField,
    toField,
  ]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!smtpConfigured) {
      addToast({
        variant: "warning",
        title: "Configurez votre SMTP pour envoyer un message.",
      });
      return;
    }

    const formData = prepareComposeFormData();
    if (!formData) {
      return;
    }

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
      router.push("/messagerie/envoyes" as Route);
    } else {
      addToast({
        variant: "error",
        title: result.message,
      });
    }
  };

  const handleScheduleRequest = () => {
    if (!smtpConfigured) {
      addToast({
        variant: "warning",
        title: "Configurez votre SMTP pour planifier un envoi.",
      });
      return;
    }
    if (!hasPrimaryRecipient) {
      addToast({
        variant: "error",
        title: "Ajoutez un destinataire avant de planifier l'envoi.",
      });
      return;
    }
    setScheduledAtInput((current) =>
      current && current.length > 0
        ? current
        : formatDateTimeLocal(new Date(Date.now() + 30 * 60 * 1000))
    );
    setScheduleDialogOpen(true);
  };

  const handleScheduleConfirm = async () => {
    const plannedValue = scheduledAtInput.trim();
    if (!plannedValue.length) {
      addToast({
        variant: "error",
        title: "Choisissez une date pour l'envoi planifié.",
      });
      return;
    }
    const scheduledDate = new Date(plannedValue);
    if (Number.isNaN(scheduledDate.getTime())) {
      addToast({
        variant: "error",
        title: "Date d'envoi invalide.",
      });
      return;
    }
    if (scheduledDate.getTime() <= Date.now()) {
      addToast({
        variant: "error",
        title: "Sélectionnez un horaire dans le futur.",
      });
      return;
    }

    const formData = prepareComposeFormData();
    if (!formData) {
      return;
    }
    formData.append("scheduledAt", scheduledDate.toISOString());

    setScheduling(true);
    const result = await safeSchedule(formData);
    setScheduling(false);

    if (!result) {
      return;
    }
    if (result.success) {
      resetToInitialDraft();
      setScheduleDialogOpen(false);
      addToast({
        variant: "success",
        title: "E-mail planifié.",
      });
      router.push("/messagerie/planifies" as Route);
    } else {
      addToast({
        variant: "error",
        title: result.message,
      });
    }
  };

  const handleScheduleCancel = () => {
    if (scheduling) {
      return;
    }
    setScheduleDialogOpen(false);
  };

  return (
    <>
      <div className="space-y-4 lg:space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Composer un nouveau message
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Rédigez votre e-mail, nous gérons l&apos;envoi via vos paramètres SMTP.
          </p>
        </div>

        <div className="mx-auto w-full max-w-5xl rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
            <div className="relative">
              <Input
                id="compose-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Sujet du message"
                required
                className={showSubjectAiButton ? "pr-12" : undefined}
              />
              {showSubjectAiButton ? (
                <button
                  type="button"
                  onClick={() => void handleSubjectAiRequest()}
                  aria-label="Proposer un objet avec l'IA"
                  title="Proposer un objet avec l'IA"
                  disabled={!subjectAiEnabled || aiSubjectLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-blue-300"
                >
                  {aiSubjectLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </div>
            {!replyContext ? (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Objet IA après {SUBJECT_AI_MIN_WORDS} mots (actuel : {bodyWordCount}
                {subjectAiRemaining > 0 ? `, manque ${subjectAiRemaining}` : ""}).
              </p>
            ) : null}
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
                {!replyContext ? (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    IA disponible après {COMPOSE_AI_MIN_WORDS} mots (actuel : {bodyWordCount}).
                  </p>
                ) : null}
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
              <div className="relative">
                <Textarea
                  id="compose-body"
                  ref={bodyTextareaRef}
                  value={plainBody}
                  onChange={(event) => handlePlainBodyChange(event.target.value)}
                  rows={10}
                  placeholder="Bonjour..."
                  className={showAiActionButton ? "pr-12" : undefined}
                />
                {aiButtonNode}
              </div>
            )}
            {editorMode === "html" && (
              <div className="relative">
                <Textarea
                  id="compose-body-html"
                  ref={htmlTextareaRef}
                  value={htmlBody}
                  onChange={(event) => handleHtmlBodyChange(event.target.value)}
                  rows={12}
                  placeholder="Collez ou saisissez votre HTML avec styles inline"
                  className={showAiActionButton ? "font-mono pr-12" : "font-mono"}
                />
                {aiButtonNode}
              </div>
            )}
            {editorMode === "preview" && (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div
                  className="prose prose-sm max-w-none text-zinc-700 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )}
            {showAiModeSelect ? (
              <div className="space-y-1">
                <label
                  htmlFor="ai-mode-select"
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                >
                  Mode d&apos;amélioration
                </label>
                <Select
                  id="ai-mode-select"
                  value={aiMode}
                  onChange={(event) =>
                    setAiMode(event.target.value as AiReplyMode)
                  }
                  disabled={aiLoading}
                  className="h-9 w-full text-sm sm:w-64"
                >
                  <option value="improve_text_html">
                    {AI_MODE_CONFIG.improve_text_html.label}
                  </option>
                  <option value="improve_text_only">
                    {AI_MODE_CONFIG.improve_text_only.label}
                  </option>
                  <option value="correct_only">
                    {AI_MODE_CONFIG.correct_only.label}
                  </option>
                </Select>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {aiModeDescription}
                </p>
              </div>
            ) : null}
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
                  className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
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
                    className="w-full text-xs text-zinc-500 hover:text-red-500 dark:text-zinc-400 sm:w-auto"
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
              {quotedHeaderHtml.trim().length ? (
                <div
                  className="text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                  dangerouslySetInnerHTML={{ __html: quotedHeaderHtml }}
                />
              ) : quotedHeaderText.trim().length ? (
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {quotedHeaderText}
                </p>
              ) : (
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Message original
                </p>
              )}
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                type="submit"
                loading={sending}
                disabled={!smtpConfigured || sending || !hasPrimaryRecipient}
                className="w-full sm:w-auto"
              >
                Envoyer
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleScheduleRequest}
                disabled={
                  !smtpConfigured || sending || scheduling || !hasPrimaryRecipient
                }
                className="w-full sm:w-auto"
              >
                Planifier l&apos;envoi
              </Button>
            </div>
            {!smtpConfigured ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                Configurez le SMTP pour activer l&apos;envoi.
              </p>
            ) : null}
          </div>
        </form>
        </div>
      </div>

      {scheduleDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Planifier l&apos;envoi
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Choisissez la date et l&apos;heure d&apos;envoi. Nous enverrons l&apos;e-mail même si vous quittez l&apos;application.
                </p>
              </div>
              <button
                type="button"
                onClick={handleScheduleCancel}
                className="text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                aria-label="Fermer la fenêtre Planifier l'envoi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <label
                htmlFor="schedule-datetime"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Date et heure d&apos;envoi
              </label>
              <Input
                id="schedule-datetime"
                type="datetime-local"
                value={scheduledAtInput}
                onChange={(event) => setScheduledAtInput(event.target.value)}
                min={formatDateTimeLocal(new Date())}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Le fuseau horaire utilisé est celui de votre navigateur.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleScheduleCancel}
                disabled={scheduling}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleScheduleConfirm}
                loading={scheduling}
              >
                Confirmer l&apos;envoi
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
