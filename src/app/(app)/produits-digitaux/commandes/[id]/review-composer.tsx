"use client";

import { Paperclip, Send, X } from "lucide-react";
import { startTransition, useActionState, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  MAX_REVIEW_ATTACHMENTS,
  REVIEW_ATTACHMENTS_ACCEPT,
  REVIEW_ATTACHMENTS_LIMIT_BYTES,
  REVIEW_ATTACHMENTS_LIMIT_LABEL,
} from "@/lib/digital-products/review-attachments";
import { formatMessagingAttachmentSize } from "@/lib/messaging/attachments";
import { sendReviewedOrderAction, type SendReviewedOrderState } from "../actions";
import { EmailEditor } from "./email-editor";

export type ComposerDocument = { id: string; kind: "invoice" | "licence"; filename: string };

/** E-mail of the order: editable subject, content and attachments, then "Envoyer". */
export function ReviewComposer({
  fulfilmentId,
  reviewVersion,
  to,
  initialSubject,
  initialHtml,
  documents,
  sendIssue,
}: {
  fulfilmentId: string;
  /** What this page shows: the server refuses to send anything else. */
  reviewVersion: string;
  to: string;
  initialSubject: string;
  initialHtml: string;
  documents: ComposerDocument[];
  sendIssue: string | null;
}) {
  const [state, submit, pending] = useActionState<SendReviewedOrderState, FormData>(sendReviewedOrderAction, { error: null });
  const [subject, setSubject] = useState(initialSubject);
  const html = useRef(initialHtml);
  const [removed, setRemoved] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const attached = documents.filter((doc) => !removed.includes(doc.id));
  const withoutLicence = !attached.some((doc) => doc.kind === "licence");

  const addFiles = (list: FileList | null) => {
    const next = [...files, ...Array.from(list ?? [])];
    if (input.current) input.current.value = "";
    if (next.length > MAX_REVIEW_ATTACHMENTS) return setFileError(`${MAX_REVIEW_ATTACHMENTS} fichiers ajoutés au maximum.`);
    if (next.reduce((sum, file) => sum + file.size, 0) > REVIEW_ATTACHMENTS_LIMIT_BYTES) {
      return setFileError(`Les fichiers ajoutés dépassent ${REVIEW_ATTACHMENTS_LIMIT_LABEL} au total.`);
    }
    setFileError(null);
    setFiles(next);
  };

  const send = () => {
    const names = [...attached.map((doc) => doc.filename), ...files.map((file) => file.name)];
    const message = [
      `Envoyer l’e-mail « ${subject.trim()} » à ${to} ?`,
      names.length ? `Pièces jointes :\n- ${names.join("\n- ")}` : "Aucune pièce jointe.",
      withoutLicence ? "Attention : aucune licence n’est jointe." : "",
    ].filter(Boolean).join("\n\n");
    if (!window.confirm(message)) return;
    const data = new FormData();
    data.set("fulfilmentId", fulfilmentId);
    data.set("reviewVersion", reviewVersion);
    data.set("subject", subject);
    data.set("html", html.current);
    for (const doc of attached) {
      if (doc.kind === "invoice") data.set("invoice", "1");
      else data.append("licence", doc.id);
    }
    for (const file of files) data.append("files", file);
    startTransition(() => submit(data));
  };

  const chip = "inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
  const remove = (label: string, run: () => void) => (
    <button type="button" aria-label={`Retirer ${label}`} title="Retirer" disabled={pending} onClick={run} className="text-zinc-500 hover:text-red-600">
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) send();
      }}
    >
      <p className="text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">À </span>
        <span className="text-zinc-900 dark:text-zinc-100">{to}</span>
      </p>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-500 dark:text-zinc-400">Objet</span>
        <input
          type="text"
          required
          maxLength={200}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>
      <div>
        <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">Contenu</p>
        <EmailEditor initialHtml={initialHtml} onChange={(value) => { html.current = value; }} />
      </div>
      <div>
        <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">Pièces jointes</p>
        <ul className="flex flex-wrap gap-2">
          {attached.map((doc) => (
            <li key={doc.id} className={chip}>
              <Paperclip className="h-4 w-4" aria-hidden="true" /> {doc.filename}
              {remove(doc.filename, () => setRemoved((list) => [...list, doc.id]))}
            </li>
          ))}
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className={chip}>
              <Paperclip className="h-4 w-4" aria-hidden="true" /> {file.name}
              <span className="text-xs text-zinc-500">({formatMessagingAttachmentSize(file.size)})</span>
              {remove(file.name, () => setFiles((list) => list.filter((_, i) => i !== index)))}
            </li>
          ))}
          {attached.length + files.length === 0 ? <li className="text-sm text-zinc-500">Aucune pièce jointe.</li> : null}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <label className="cursor-pointer text-blue-600 hover:underline dark:text-blue-400">
            Ajouter un fichier
            <input
              ref={input}
              type="file"
              multiple
              accept={REVIEW_ATTACHMENTS_ACCEPT}
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
            />
          </label>
          {removed.map((id) => {
            const doc = documents.find((entry) => entry.id === id);
            return doc ? (
              <button key={id} type="button" className="text-blue-600 hover:underline dark:text-blue-400" onClick={() => setRemoved((list) => list.filter((entry) => entry !== id))}>
                Remettre {doc.filename}
              </button>
            ) : null;
          })}
          <span className="text-xs text-zinc-500">Fichiers ajoutés : {REVIEW_ATTACHMENTS_LIMIT_LABEL} au total.</span>
        </div>
        {fileError ? <p role="alert" className="mt-1 text-sm text-red-600">{fileError}</p> : null}
        {withoutLicence ? <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">Aucune licence n’est jointe à cet e-mail.</p> : null}
      </div>
      {state.error ? <Alert variant="error" title="L’envoi a échoué." description={state.error} /> : null}
      {sendIssue ? <Alert variant="error" title="Envoi impossible pour le moment" description={sendIssue} /> : null}
      <Button type="submit" disabled={pending || Boolean(sendIssue)} className="w-full sm:w-auto">
        <Send className="h-4 w-4" aria-hidden="true" /> {pending ? "Envoi…" : "Envoyer au client"}
      </Button>
    </form>
  );
}
