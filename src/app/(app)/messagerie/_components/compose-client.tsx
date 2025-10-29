"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Paperclip,
  Sparkles,
  UploadCloud,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { sendEmailAction, type ActionResult } from "@/app/(app)/messagerie/actions";
import type {
  MessagingQuickReply,
  MessagingResponseTemplate,
  MessagingDocumentCollections,
} from "@/server/messaging";

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
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const display = exponent === 0 ? value : value.toFixed(1);
  return `${display} ${units[exponent]}`;
}

function formatCurrency(amountCents: number, currency: string): string {
  const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
  return formatter.format(amountCents / 100);
}

function formatDocumentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

type ComposeInitialDraft = {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  quotedHtml?: string;
  quotedText?: string;
};

type ComposeClientProps = {
  fromEmail: string | null;
  senderName: string;
  smtpConfigured: boolean;
  initialDraft?: ComposeInitialDraft | null;
  quickReplies: MessagingQuickReply[];
  responseTemplates: MessagingResponseTemplate[];
  documents: MessagingDocumentCollections;
  signature: string;
  signatureHtml: string | null;
};

export function ComposeClient({
  fromEmail,
  senderName,
  smtpConfigured,
  initialDraft,
  quickReplies,
  responseTemplates,
  documents,
  signature,
  signatureHtml,
}: ComposeClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const quotedHtml = useMemo(
    () => initialDraft?.quotedHtml ?? "",
    [initialDraft],
  );
  const quotedText = useMemo(
    () => initialDraft?.quotedText ?? "",
    [initialDraft],
  );

  const [to, setTo] = useState(initialDraft?.to?.join(", ") ?? "");
  const [cc, setCc] = useState(initialDraft?.cc?.join(", ") ?? "");
  const [bcc, setBcc] = useState(initialDraft?.bcc?.join(", ") ?? "");
  const [subject, setSubject] = useState(initialDraft?.subject ?? "");
  const [body, setBody] = useState(initialDraft?.body ?? "");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [preferredTemplateId, setPreferredTemplateId] = useState<string | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const { invoices, quotes } = documents;
  const signatureText = signature.trim();
  const signatureHtmlPreview = signatureHtml?.trim() ?? "";
  const hasSignature = signatureText.length > 0 || signatureHtmlPreview.length > 0;
  const selectedTemplateId = useMemo(() => {
    if (
      preferredTemplateId &&
      responseTemplates.some((template) => template.id === preferredTemplateId)
    ) {
      return preferredTemplateId;
    }
    return responseTemplates[0]?.id ?? "";
  }, [preferredTemplateId, responseTemplates]);

  const senderDisplay = useMemo(() => {
    const email = fromEmail ?? "non configuré";
    const name = senderName.trim();
    return name ? `${name} <${email}>` : email;
  }, [fromEmail, senderName]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files ?? []);
      if (incoming.length === 0) return;

      setAttachments((current) => {
        const existingFingerprints = new Set(
          current.map((file) => `${file.name}__${file.size}`),
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
    [addToast],
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        addFiles(event.target.files);
        event.target.value = "";
      }
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.dataTransfer?.files) {
        addFiles(event.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((current) => current.filter((_, idx) => idx !== index));
  }, []);

  const handleInsertQuickReply = useCallback(
    (reply: MessagingQuickReply) => {
      const content = reply.body.trim();
      if (!content) {
        addToast({
          variant: "warning",
          title: "Ce modèle est vide.",
        });
        return;
      }
      setBody((current) => {
        const trimmed = current.trimEnd();
        return trimmed.length > 0
          ? `${trimmed}\n\n${content}`
          : content;
      });
      addToast({
        variant: "success",
        title: "Réponse insérée dans le message.",
      });
    },
    [addToast],
  );

  const selectedTemplate = useMemo(
    () =>
      responseTemplates.find((template) => template.id === selectedTemplateId) ??
      null,
    [responseTemplates, selectedTemplateId],
  );

  const handleApplyTemplate = useCallback(() => {
    if (!selectedTemplate) {
      addToast({
        variant: "warning",
        title: "Sélectionnez un modèle avant de l'appliquer.",
      });
      return;
    }
    const nextSubject = selectedTemplate.subject.trim();
    if (nextSubject.length > 0) {
      setSubject(nextSubject);
    }
    const nextBody = selectedTemplate.body.trim();
    if (nextBody.length > 0) {
      setBody((current) => {
        const trimmed = current.trim();
        return trimmed.length > 0
          ? `${nextBody}\n\n${trimmed}`
          : nextBody;
      });
    }
    addToast({
      variant: "success",
      title: "Modèle appliqué au message.",
    });
  }, [addToast, selectedTemplate]);

  const handleToggleInvoice = useCallback((id: string) => {
    setSelectedInvoices((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }, []);

  const handleToggleQuote = useCallback((id: string) => {
    setSelectedQuotes((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }, []);

  const selectedDocumentsCount = selectedInvoices.length + selectedQuotes.length;
  const hasDocumentOptions = useMemo(
    () => invoices.length > 0 || quotes.length > 0,
    [invoices, quotes],
  );

  async function safeSubmit(formData: FormData): Promise<ActionResult | null> {
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
    setTo(initialDraft?.to?.join(", ") ?? "");
    setCc(initialDraft?.cc?.join(", ") ?? "");
    setBcc(initialDraft?.bcc?.join(", ") ?? "");
    setSubject(initialDraft?.subject ?? "");
    setBody(initialDraft?.body ?? "");
    setAttachments([]);
      setSelectedInvoices([]);
      setSelectedQuotes([]);
      setPreferredTemplateId(responseTemplates[0]?.id ?? null);
  }, [initialDraft, responseTemplates]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!smtpConfigured) {
      addToast({
        variant: "warning",
        title: "Configurez votre SMTP pour envoyer un message.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("to", to);
    formData.append("cc", cc);
    formData.append("bcc", bcc);
    formData.append("subject", subject);
    formData.append("body", body);
    formData.append("quotedHtml", quotedHtml);
    formData.append("quotedText", quotedText);
    attachments.forEach((file) => {
      formData.append("attachments", file);
    });
    selectedInvoices.forEach((id) => {
      formData.append("invoiceIds", id);
    });
    selectedQuotes.forEach((id) => {
      formData.append("quoteIds", id);
    });

    setSending(true);
    const result = await safeSubmit(formData);
    setSending(false);

    if (!result) {
      return;
    }

    if (result.success) {
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
          Rédigez votre e-mail, nous gérons l&apos;envoi via vos paramètres SMTP.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Expéditeur :
          </span>{" "}
          {senderDisplay}
        </div>
        {quickReplies.length > 0 ? (
          <div className="mb-4 space-y-2 rounded-md border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              Réponses rapides
            </div>
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((reply) => (
                <Button
                  key={reply.id}
                  type="button"
                  variant="secondary"
                  onClick={() => handleInsertQuickReply(reply)}
                  className="text-xs"
                >
                  {reply.title}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {responseTemplates.length > 0 ? (
          <div className="mb-4 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-200">
                <FileText className="h-4 w-4" />
                Modèles de réponse
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedTemplateId}
                  onChange={(event) =>
                    setPreferredTemplateId(
                      event.target.value ? event.target.value : null,
                    )
                  }
                  className="input"
                >
                  {responseTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="secondary" onClick={handleApplyTemplate}>
                  Appliquer le modèle
                </Button>
              </div>
            </div>
            {selectedTemplate ? (
              <div className="rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                <p className="font-semibold text-zinc-700 dark:text-zinc-100">
                  Sujet suggéré : {" "}
                  <span className="font-medium">
                    {selectedTemplate.subject?.trim().length
                      ? selectedTemplate.subject
                      : "(Sans objet)"}
                  </span>
                </p>
                {selectedTemplate.body.trim().length ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">
                    {selectedTemplate.body}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="compose-to"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Destinataires (séparés par des virgules)
              </label>
              <Input
                id="compose-to"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="contact@example.com, autre@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="compose-cc"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Cc
              </label>
              <Input
                id="compose-cc"
                value={cc}
                onChange={(event) => setCc(event.target.value)}
                placeholder="adresse@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="compose-bcc"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Cci
              </label>
              <Input
                id="compose-bcc"
                value={bcc}
                onChange={(event) => setBcc(event.target.value)}
                placeholder="adresse@example.com"
              />
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

          <div className="space-y-1.5">
            <label
              htmlFor="compose-body"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              Message
            </label>
            <Textarea
              id="compose-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={10}
              placeholder="Bonjour..."
              required
            />
          </div>

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
                Formats acceptés : images, PDF, documents, audio. Taille max : 10 Mo par fichier.
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

          {hasDocumentOptions ? (
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-100">
                  <FileText className="h-4 w-4" />
                  Pièces jointes depuis l&apos;application
                </div>
                {selectedDocumentsCount > 0 ? (
                  <Badge variant="info">
                    {selectedDocumentsCount} sélectionnée
                    {selectedDocumentsCount > 1 ? "s" : ""}
                  </Badge>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {invoices.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Factures
                    </p>
                    <ul className="space-y-2 text-xs">
                      {invoices.map((invoice) => {
                        const checked = selectedInvoices.includes(invoice.id);
                        return (
                          <li key={invoice.id} className="flex items-start gap-2 rounded-md border border-transparent p-2 hover:border-blue-200 dark:hover:border-blue-500/40">
                            <input
                              type="checkbox"
                              className="mt-1 h-3.5 w-3.5 accent-blue-600"
                              checked={checked}
                              onChange={() => handleToggleInvoice(invoice.id)}
                              aria-label={`Joindre la facture ${invoice.number}`}
                            />
                            <div className="space-y-1">
                              <p className="font-medium text-zinc-700 dark:text-zinc-100">
                                {invoice.number}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {invoice.clientName} · {formatCurrency(invoice.totalCents, invoice.currency)} · {formatDocumentDate(invoice.issueDate)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {quotes.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Devis
                    </p>
                    <ul className="space-y-2 text-xs">
                      {quotes.map((quote) => {
                        const checked = selectedQuotes.includes(quote.id);
                        return (
                          <li key={quote.id} className="flex items-start gap-2 rounded-md border border-transparent p-2 hover:border-blue-200 dark:hover:border-blue-500/40">
                            <input
                              type="checkbox"
                              className="mt-1 h-3.5 w-3.5 accent-blue-600"
                              checked={checked}
                              onChange={() => handleToggleQuote(quote.id)}
                              aria-label={`Joindre le devis ${quote.number}`}
                            />
                            <div className="space-y-1">
                              <p className="font-medium text-zinc-700 dark:text-zinc-100">
                                {quote.number}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {quote.clientName} · {formatCurrency(quote.totalCents, quote.currency)} · {formatDocumentDate(quote.issueDate)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {hasSignature ? (
            <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Signature ajoutée automatiquement
              </p>
              {signatureHtmlPreview.length > 0 ? (
                <div
                  className="prose prose-sm max-w-none text-zinc-700 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: signatureHtmlPreview }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
                  {signatureText}
                </pre>
              )}
            </div>
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
              disabled={!smtpConfigured || sending || to.trim().length === 0}
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
