"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { MessagingSettingsSummary } from "@/server/messaging";
import {
  updateMessagingConnectionsAction,
  updateMessagingIdentityAction,
  updateAutoReplySettingsAction,
  testImapConnectionAction,
  testSmtpConnectionAction,
  updateEmailTrackingPreferenceAction,
  type ActionResult,
} from "@/app/(app)/messagerie/actions";
import { useToast } from "@/components/ui/toast-provider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SavedResponse } from "@/lib/messaging/saved-responses";
import { SavedResponsesManager } from "@/app/(app)/messagerie/_components/saved-responses-manager";
import { VACATION_PLACEHOLDER_TOKENS } from "@/lib/messaging/auto-reply";

type ParametersClientProps = {
  summary: MessagingSettingsSummary;
  savedResponses: SavedResponse[];
};

export function ParametersClient({ summary, savedResponses }: ParametersClientProps) {
  const identityFormRef = useRef<HTMLFormElement | null>(null);
  const connectionFormRef = useRef<HTMLFormElement | null>(null);
  const autoReplyFormRef = useRef<HTMLFormElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const logoUrlInputRef = useRef<HTMLInputElement | null>(null);
  const { addToast } = useToast();
  const router = useRouter();
  const initialLogoUrl = summary.senderLogoUrl ?? "";
  const [logoPreview, setLogoPreview] = useState(initialLogoUrl);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(summary.trackingEnabled);
  const [updatingTracking, setUpdatingTracking] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingConnections, setSavingConnections] = useState(false);
  const [savingAutoReply, setSavingAutoReply] = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  useEffect(() => {
    return () => {
      if (logoObjectUrl) {
        URL.revokeObjectURL(logoObjectUrl);
      }
    };
  }, [logoObjectUrl]);

  useEffect(() => {
    setTrackingEnabled(summary.trackingEnabled);
  }, [summary.trackingEnabled]);

  useEffect(() => {
    setLogoObjectUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
    const nextLogo = summary.senderLogoUrl ?? "";
    setLogoPreview(nextLogo);
    setLogoRemoved(false);
    if (logoUrlInputRef.current) {
      logoUrlInputRef.current.value = nextLogo;
    }
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = "";
    }
  }, [summary.senderLogoUrl]);

  const handleLogoFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      if (logoUrlInputRef.current) {
        logoUrlInputRef.current.value = "";
      }
      setLogoRemoved(false);
      const nextUrl = URL.createObjectURL(file);
      setLogoObjectUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return nextUrl;
      });
      setLogoPreview(nextUrl);
    },
    [],
  );

  const handleLogoRemove = useCallback(() => {
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = "";
    }
    if (logoUrlInputRef.current) {
      logoUrlInputRef.current.value = "";
    }
    setLogoPreview("");
    setLogoRemoved(true);
    setLogoObjectUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  }, []);

  const handleLogoUrlChange = useCallback(() => {
    setLogoRemoved(false);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = "";
    }
    setLogoObjectUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
    setLogoPreview("");
  }, []);

  const handleLogoUrlBlur = useCallback(() => {
    const value = logoUrlInputRef.current?.value?.trim() ?? "";
    if (!value.length) {
      setLogoPreview("");
      return;
    }
    setLogoPreview(value);
  }, []);

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

  const trackingStatusBadge = useMemo(
    () => (
      <Badge variant={trackingEnabled ? "success" : "neutral"}>
        {trackingEnabled ? "Suivi activé" : "Suivi désactivé"}
      </Badge>
    ),
    [trackingEnabled],
  );

  const callFormAction = useCallback(
    async <T,>(
      form: HTMLFormElement | null,
      action: (formData: FormData) => Promise<ActionResult<T>>,
    ): Promise<ActionResult<T> | null> => {
      if (!form) {
        return null;
      }
      try {
        return await action(new FormData(form));
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

  const handleIdentitySave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingIdentity(true);
    const result = await callFormAction(
      identityFormRef.current,
      updateMessagingIdentityAction,
    );
    setSavingIdentity(false);
    if (!result) return;
    if (result.success) {
      addToast({
        variant: "success",
        title: "✅ Paramètres mis à jour avec succès.",
      });
    } else {
      addToast({
        variant: "error",
        title: "❌ Échec de la mise à jour des paramètres.",
        description: result.message,
      });
    }
  };

  const handleConnectionsSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingConnections(true);
    const result = await callFormAction(
      connectionFormRef.current,
      updateMessagingConnectionsAction,
    );
    setSavingConnections(false);
    if (!result) return;
    if (result.success) {
      addToast({
        variant: "success",
        title: "✅ Paramètres mis à jour avec succès.",
      });
    } else {
      addToast({
        variant: "error",
        title: "❌ Échec de la mise à jour des paramètres.",
        description: result.message,
      });
    }
  };

  const handleAutoReplySave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingAutoReply(true);
    const result = await callFormAction(
      autoReplyFormRef.current,
      updateAutoReplySettingsAction,
    );
    setSavingAutoReply(false);
    if (!result) {
      return;
    }
    if (result.success) {
      addToast({
        variant: "success",
        title: result.message ?? "Réponses automatiques mises à jour.",
      });
      router.refresh();
    } else {
      addToast({
        variant: "error",
        title: result.message ?? "Échec de la mise à jour des réponses automatiques.",
      });
    }
  };

  const handleTestImap = async () => {
    setTestingImap(true);
    const result = await callFormAction(
      connectionFormRef.current,
      testImapConnectionAction,
    );
    setTestingImap(false);
    if (!result) return;
    addToast({
      variant: result.success ? "success" : "error",
      title: result.message ?? "",
    });
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    const result = await callFormAction(
      connectionFormRef.current,
      testSmtpConnectionAction,
    );
    setTestingSmtp(false);
    if (!result) return;
    addToast({
      variant: result.success ? "success" : "error",
      title: result.message ?? "",
    });
  };

  const handleTrackingToggle = useCallback(async () => {
    setUpdatingTracking(true);
    const nextValue = !trackingEnabled;
    try {
      const formData = new FormData();
      formData.append("enabled", nextValue ? "true" : "false");
      const result = await updateEmailTrackingPreferenceAction(formData);
      if (result?.success) {
        setTrackingEnabled(nextValue);
        addToast({
          variant: "success",
          title:
            result.message ??
            (nextValue
              ? "Suivi des e-mails activé."
              : "Suivi des e-mails désactivé."),
        });
        router.refresh();
      } else if (result) {
        addToast({
          variant: "error",
          title: result.message ?? "Échec de la mise à jour du suivi.",
        });
      }
    } catch (error) {
      console.error("Impossible de modifier le suivi des e-mails:", error);
      addToast({
        variant: "error",
        title: "Impossible de mettre à jour le suivi des e-mails.",
      });
    } finally {
      setUpdatingTracking(false);
    }
  }, [trackingEnabled, addToast, router]);

  const hasStoredLogo = (summary.senderLogoUrl ?? "").length > 0;
  const hasPreview = logoPreview.length > 0;
  const canRemoveLogo =
    hasPreview || (!logoRemoved && hasStoredLogo) || Boolean(logoObjectUrl);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 lg:space-y-5">
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

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Suivi des e-mails envoyés
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ajoutez un pixel d&apos;ouverture et des liens traqués pour suivre l&apos;engagement
              destinataire par destinataire. La désactivation coupe instantanément ces éléments.
            </p>
            {trackingStatusBadge}
          </div>
          <Button
            type="button"
            variant={trackingEnabled ? "ghost" : "secondary"}
            onClick={handleTrackingToggle}
            loading={updatingTracking}
            className="w-full sm:w-auto"
          >
            {trackingEnabled ? "Désactiver le suivi" : "Activer le suivi"}
          </Button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Le suivi reste limité à votre locataire : chaque pixel et lien est signé par un jeton
          impossible à deviner, sans exposer d&apos;adresse ou de contenu sensible.
        </p>
      </section>

      <form
        ref={autoReplyFormRef}
        onSubmit={handleAutoReplySave}
        className="space-y-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Réponses automatiques
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Accusez réception dès qu&apos;un message arrive et planifiez un message de congés qui
            prend automatiquement le relais pendant vos absences.
          </p>
        </div>
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  Réponse standard
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Envoyée au plus une fois toutes les 24h par expéditeur.
                </p>
              </div>
              <label className="label flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                <input type="hidden" name="autoReplyEnabled" value="false" />
                <input
                  type="checkbox"
                  name="autoReplyEnabled"
                  value="true"
                  defaultChecked={summary.autoReplyEnabled}
                  className="checkbox"
                />
                Activer
              </label>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="auto-reply-subject">
                Sujet
              </label>
              <Input
                id="auto-reply-subject"
                name="autoReplySubject"
                defaultValue={summary.autoReplySubject}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="auto-reply-body">
                Message
              </label>
              <Textarea
                id="auto-reply-body"
                name="autoReplyBody"
                rows={4}
                defaultValue={summary.autoReplyBody}
                required
              />
            </div>
          </div>
          <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  Mode vacances
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Remplace la réponse standard pendant la période définie.
                </p>
              </div>
              <label className="label flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                <input type="hidden" name="vacationModeEnabled" value="false" />
                <input
                  type="checkbox"
                  name="vacationModeEnabled"
                  value="true"
                  defaultChecked={summary.vacationModeEnabled}
                  className="checkbox"
                />
                Activer
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="vacation-start">
                  Début
                </label>
                <Input
                  id="vacation-start"
                  type="date"
                  name="vacationStartDate"
                  defaultValue={summary.vacationStartDate ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="vacation-end">
                  Fin
                </label>
                <Input
                  id="vacation-end"
                  type="date"
                  name="vacationEndDate"
                  defaultValue={summary.vacationEndDate ?? ""}
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Les dates de début et de fin sont obligatoires pour activer le mode vacances.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="vacation-subject">
                Sujet
              </label>
              <Input
                id="vacation-subject"
                name="vacationSubject"
                defaultValue={summary.vacationSubject}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="vacation-backup-email">
                Contact de secours
              </label>
              <Input
                id="vacation-backup-email"
                name="vacationBackupEmail"
                type="email"
                placeholder="support@exemple.com"
                defaultValue={summary.vacationBackupEmail ?? ""}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Facultatif — apparaîtra à la place de{" "}
                <code className="font-mono text-xs text-zinc-700 dark:text-zinc-200">
                  {"{{backup_email}}"}
                </code>{" "}
                si renseigné.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="vacation-message">
                Message
              </label>
              <Textarea
                id="vacation-message"
                name="vacationMessage"
                rows={4}
                defaultValue={summary.vacationMessage}
                required
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Variables disponibles&nbsp;:{" "}
                <span className="font-medium">{VACATION_PLACEHOLDER_TOKENS.join(", ")}</span>
              </p>
            </div>
          </div>
        </section>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            loading={savingAutoReply}
            className="w-full sm:w-auto"
          >
            Enregistrer les réponses automatiques
          </Button>
        </div>
      </form>

      <form
        ref={identityFormRef}
        onSubmit={handleIdentitySave}
        className="space-y-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Identité de l&apos;expéditeur
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Mettez à jour le nom affiché et le logo sans toucher aux identifiants IMAP/SMTP.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="removeLogo" value={logoRemoved ? "true" : "false"} />
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
            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor="sender-logo-file"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Logo d&apos;expéditeur
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-dashed border-blue-200 bg-blue-50/60 dark:border-blue-400/40 dark:bg-blue-500/10 sm:h-24 sm:w-24">
                  {hasPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo d'expéditeur"
                      className="h-full w-full object-contain"
                      style={{ maxWidth: "120px" }}
                    />
                  ) : (
                    <span className="px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-blue-500/70 dark:text-blue-200/70">
                      Aucun logo
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Input
                    ref={logoFileInputRef}
                    id="sender-logo-file"
                    name="senderLogoFile"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => logoFileInputRef.current?.click()}
                    >
                      Importer un logo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={handleLogoRemove}
                      disabled={!canRemoveLogo}
                    >
                      Supprimer
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    PNG, JPG, GIF ou SVG - 2 Mo max. Affichage recommandé : 120 px de large
                    (redimensionnement automatique dans les e-mails).
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="sender-logo-url"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Logo d&apos;expéditeur (URL)
              </label>
              <Input
                ref={logoUrlInputRef}
                id="sender-logo-url"
                name="senderLogoUrl"
                type="url"
                defaultValue={summary.senderLogoUrl ?? ""}
                placeholder="https://exemple.com/logo.png"
                onChange={handleLogoUrlChange}
                onBlur={handleLogoUrlBlur}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Fournissez une URL si votre logo est déjà hébergé en ligne. Laissez ce champ vide
                pour utiliser le fichier importé ou masquer le logo.
              </p>
            </div>
          </div>
        </section>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            loading={savingIdentity}
            className="w-full sm:w-auto"
          >
            Enregistrer l&apos;identité
          </Button>
        </div>
      </form>

      <form
        ref={connectionFormRef}
        onSubmit={handleConnectionsSave}
        className="space-y-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
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
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Boîte de réception (IMAP)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Renseignez l&apos;identifiant et le mot de passe uniquement si vous souhaitez les modifier.
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
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
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
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Laissez vide pour conserver l&apos;identifiant actuel.
              </p>
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
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Laissez vide pour conserver le mot de passe actuel.
              </p>
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
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
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
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Laissez vide pour conserver l&apos;identifiant actuel.
              </p>
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
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Laissez vide pour conserver le mot de passe actuel.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestImap}
              loading={testingImap}
              className="w-full sm:w-auto"
            >
              Tester IMAP
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestSmtp}
              loading={testingSmtp}
              className="w-full sm:w-auto"
            >
              Tester SMTP
            </Button>
          </div>
          <Button
            type="submit"
            loading={savingConnections}
            className="w-full sm:w-auto"
          >
            Mettre à jour les identifiants
          </Button>
        </div>
      </form>

      <SavedResponsesManager initialResponses={savedResponses} />
    </div>
  );
}
