"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { MessagingSettingsSummary } from "@/server/messaging";
import {
  saveMessagingSettingsAction,
  testImapConnectionAction,
  testSmtpConnectionAction,
  type ActionResult,
} from "@/app/(app)/messagerie/actions";
import { useToast } from "@/components/ui/toast-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

type ParametersClientProps = {
  summary: MessagingSettingsSummary;
};

export function ParametersClient({ summary }: ParametersClientProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const QUICK_REPLY_LIMIT = 10;
  const RESPONSE_TEMPLATE_LIMIT = 10;
  const [signature, setSignature] = useState(summary.signature);
  const [signatureHtml, setSignatureHtml] = useState(
    summary.signatureHtml ?? "",
  );
  const [quickReplies, setQuickReplies] = useState(summary.quickReplies);
  const [responseTemplates, setResponseTemplates] = useState(
    summary.responseTemplates,
  );

  const imapConfiguredBadge = useMemo(
    () => (
      <Badge variant={summary.imapConfigured ? "success" : "warning"}>
        {summary.imapConfigured ? "IMAP configuré" : "IMAP manquant"}
      </Badge>
    ),
    [summary.imapConfigured],
  );

  const smtpConfiguredBadge = useMemo(
    () => (
      <Badge variant={summary.smtpConfigured ? "success" : "warning"}>
        {summary.smtpConfigured ? "SMTP configuré" : "SMTP manquant"}
      </Badge>
    ),
    [summary.smtpConfigured],
  );

  const safeActionCall = useCallback(
    async <T,>(
      action: (formData: FormData) => Promise<ActionResult<T>>,
    ): Promise<ActionResult<T> | null> => {
      if (!formRef.current) {
        return null;
      }
      try {
        return await action(new FormData(formRef.current));
      } catch (error) {
        console.error("Erreur réseau lors d'une action paramètres:", error);
        addToast({
          variant: "error",
          title: "Erreur réseau.",
        });
        return null;
      }
    },
    [addToast],
  );

  const handleAddQuickReply = useCallback(() => {
    if (quickReplies.length >= QUICK_REPLY_LIMIT) {
      addToast({
        variant: "warning",
        title: "Limite de réponses rapides atteinte.",
      });
      return;
    }
    setQuickReplies((current) => [
      ...current,
      { id: crypto.randomUUID(), title: `Réponse ${current.length + 1}`, body: "" },
    ]);
  }, [addToast, quickReplies.length]);

  const handleUpdateQuickReply = useCallback(
    (id: string, field: "title" | "body", value: string) => {
      setQuickReplies((current) =>
        current.map((reply) =>
          reply.id === id ? { ...reply, [field]: value } : reply,
        ),
      );
    },
    [],
  );

  const handleRemoveQuickReply = useCallback((id: string) => {
    setQuickReplies((current) => current.filter((reply) => reply.id !== id));
  }, []);

  const handleAddTemplate = useCallback(() => {
    if (responseTemplates.length >= RESPONSE_TEMPLATE_LIMIT) {
      addToast({
        variant: "warning",
        title: "Limite de modèles atteinte.",
      });
      return;
    }
    setResponseTemplates((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: `Modèle ${current.length + 1}`,
        subject: "",
        body: "",
      },
    ]);
  }, [addToast, responseTemplates.length]);

  const handleUpdateTemplate = useCallback(
    (id: string, field: "title" | "subject" | "body", value: string) => {
      setResponseTemplates((current) =>
        current.map((template) =>
          template.id === id ? { ...template, [field]: value } : template,
        ),
      );
    },
    [],
  );

  const handleRemoveTemplate = useCallback((id: string) => {
    setResponseTemplates((current) =>
      current.filter((template) => template.id !== id),
    );
  }, []);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formRef.current) return;
    setSaving(true);
    const result = await safeActionCall(saveMessagingSettingsAction);
    setSaving(false);
    if (!result) return;
    if (result.success) {
      addToast({
        variant: "success",
        title: result.message ?? "Paramètres enregistrés.",
      });
    } else {
      addToast({
        variant: "error",
        title: result.message,
      });
    }
  };

  const handleTestImap = async () => {
    setTestingImap(true);
    const result = await safeActionCall(testImapConnectionAction);
    setTestingImap(false);
    if (!result) return;
    addToast({
      variant: result.success ? "success" : "error",
      title: result.message ?? "",
    });
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    const result = await safeActionCall(testSmtpConnectionAction);
    setTestingSmtp(false);
    if (!result) return;
    addToast({
      variant: result.success ? "success" : "error",
      title: result.message ?? "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Paramètres IMAP / SMTP
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Les identifiants sont chiffrés côté serveur. Renseignez à
            chaque mise à jour.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {imapConfiguredBadge}
          {smtpConfiguredBadge}
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSave}
        className="space-y-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input
          type="hidden"
          name="quickReplies"
          value={JSON.stringify(quickReplies)}
        />
        <input
          type="hidden"
          name="responseTemplates"
          value={JSON.stringify(responseTemplates)}
        />
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Adresse d&apos;envoi
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="from-email"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Adresse e-mail
              </label>
              <Input
                id="from-email"
                name="fromEmail"
                type="email"
                defaultValue={summary.fromEmail}
                placeholder="expediteur@example.com"
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="sender-name"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Nom d&apos;expéditeur
              </label>
              <Input
                id="sender-name"
                name="senderName"
                defaultValue={summary.senderName}
                placeholder="Nom de votre entreprise"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="sender-logo"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Logo d&apos;expéditeur (URL)
              </label>
              <Input
                id="sender-logo"
                name="senderLogoUrl"
                type="url"
                defaultValue={summary.senderLogoUrl ?? ""}
                placeholder="https://exemple.com/logo.png"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Fournissez une URL vers une image (PNG, JPG ou SVG) affichée
                dans l&apos;en-tête des e-mails.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="sender-signature"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Signature texte
              </label>
              <Textarea
                id="sender-signature"
                name="signature"
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                rows={4}
                placeholder={"Cordialement,\nNom de l'entreprise"}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ajoutée automatiquement à la version texte des e-mails.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="sender-signature-html"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Signature HTML
              </label>
              <Textarea
                id="sender-signature-html"
                name="signatureHtml"
                value={signatureHtml}
                onChange={(event) => setSignatureHtml(event.target.value)}
                rows={4}
                placeholder="<p>Cordialement,<br />Votre société</p>"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Optionnelle. Permet d&apos;ajouter un formatage riche ou un logo.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Réponses rapides
            </h3>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddQuickReply}
              disabled={quickReplies.length >= QUICK_REPLY_LIMIT}
              className="inline-flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Ajouter une réponse
            </Button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Ces réponses peuvent être insérées en un clic lors de la rédaction.
          </p>
          {quickReplies.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 p-4 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Aucune réponse rapide définie pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {quickReplies.map((reply, index) => (
                <div
                  key={reply.id}
                  className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      Réponse {index + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-red-500 hover:text-red-400"
                      onClick={() => handleRemoveQuickReply(reply.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Supprimer la réponse</span>
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Titre
                    </label>
                    <Input
                      value={reply.title}
                      onChange={(event) =>
                        handleUpdateQuickReply(reply.id, "title", event.target.value)
                      }
                      placeholder="Confirmation de réception"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Contenu
                    </label>
                    <Textarea
                      value={reply.body}
                      onChange={(event) =>
                        handleUpdateQuickReply(reply.id, "body", event.target.value)
                      }
                      rows={3}
                      placeholder="Bonjour,\nNous confirmons la bonne réception..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Modèles de réponse
            </h3>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddTemplate}
              disabled={responseTemplates.length >= RESPONSE_TEMPLATE_LIMIT}
              className="inline-flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Ajouter un modèle
            </Button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Les modèles pré-remplissent sujet et corps pour vos réponses fréquentes.
          </p>
          {responseTemplates.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 p-4 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Aucun modèle enregistré pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {responseTemplates.map((template, index) => (
                <div
                  key={template.id}
                  className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      Modèle {index + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-red-500 hover:text-red-400"
                      onClick={() => handleRemoveTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Supprimer le modèle</span>
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Nom interne
                    </label>
                    <Input
                      value={template.title}
                      onChange={(event) =>
                        handleUpdateTemplate(template.id, "title", event.target.value)
                      }
                      placeholder="Relance paiement"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Sujet suggéré
                    </label>
                    <Input
                      value={template.subject}
                      onChange={(event) =>
                        handleUpdateTemplate(template.id, "subject", event.target.value)
                      }
                      placeholder="Votre facture est disponible"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Corps du message
                    </label>
                    <Textarea
                      value={template.body}
                      onChange={(event) =>
                        handleUpdateTemplate(template.id, "body", event.target.value)
                      }
                      rows={4}
                      placeholder="Bonjour {nom},\n..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Boîte de réception (IMAP)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Pour préserver la sécurité, saisissez l&apos;identifiant et le
              mot de passe à chaque modification.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="imap-host"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Serveur IMAP
              </label>
              <Input
                id="imap-host"
                name="imapHost"
                defaultValue={summary.imapHost}
                placeholder="imap.exemple.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="imap-port"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Port
              </label>
              <Input
                id="imap-port"
                name="imapPort"
                type="number"
                min={1}
                max={65535}
                defaultValue={summary.imapPort ?? 993}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="imap-secure"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Sécurité
              </label>
              <select
                id="imap-secure"
                name="imapSecure"
                defaultValue={summary.imapSecure ? "true" : "false"}
                className="input"
              >
                <option value="true">SSL/TLS (recommandé)</option>
                <option value="false">STARTTLS / Non chiffré</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="imap-user"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Identifiant
              </label>
              <Input
                id="imap-user"
                name="imapUser"
                placeholder="Identifiant IMAP"
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="imap-password"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Mot de passe
              </label>
              <Input
                id="imap-password"
                name="imapPassword"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Envoi (SMTP)
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="smtp-host"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Serveur SMTP
              </label>
              <Input
                id="smtp-host"
                name="smtpHost"
                defaultValue={summary.smtpHost}
                placeholder="smtp.exemple.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="smtp-port"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Port
              </label>
              <Input
                id="smtp-port"
                name="smtpPort"
                type="number"
                min={1}
                max={65535}
                defaultValue={summary.smtpPort ?? 465}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="smtp-secure"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Sécurité
              </label>
              <select
                id="smtp-secure"
                name="smtpSecure"
                defaultValue={summary.smtpSecure ? "true" : "false"}
                className="input"
              >
                <option value="true">SSL/TLS (recommandé)</option>
                <option value="false">STARTTLS / Non chiffré</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="smtp-user"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Identifiant
              </label>
              <Input
                id="smtp-user"
                name="smtpUser"
                placeholder="Identifiant SMTP"
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="smtp-password"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Mot de passe
              </label>
              <Input
                id="smtp-password"
                name="smtpPassword"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestImap}
              loading={testingImap}
            >
              Tester IMAP
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestSmtp}
              loading={testingSmtp}
            >
              Tester SMTP
            </Button>
          </div>
          <Button type="submit" loading={saving}>
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}
