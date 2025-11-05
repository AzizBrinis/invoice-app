"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import {
  createSavedResponseAction,
  updateSavedResponseAction,
  deleteSavedResponseAction,
} from "@/app/(app)/messagerie/actions";
import type { SavedResponse } from "@/lib/messaging/saved-responses";

type SavedResponsesManagerProps = {
  initialResponses: SavedResponse[];
};

const FORMAT_LABELS: Record<SavedResponse["format"], string> = {
  PLAINTEXT: "Texte brut",
  HTML: "HTML",
};

const formatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function sortResponses(entries: SavedResponse[]): SavedResponse[] {
  return [...entries].sort((a, b) => {
    if (a.builtIn !== b.builtIn) {
      return a.builtIn ? -1 : 1;
    }
    const updatedDiff =
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (updatedDiff !== 0) {
      return updatedDiff;
    }
    return a.title.localeCompare(b.title);
  });
}

export function SavedResponsesManager({
  initialResponses,
}: SavedResponsesManagerProps) {
  const { addToast } = useToast();
  const [responses, setResponses] = useState(() =>
    sortResponses(initialResponses),
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [updatePendingId, setUpdatePendingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      setCreatePending(true);
      const result = await createSavedResponseAction(formData);
      setCreatePending(false);
      if (!result) {
        return;
      }
      if (result.success && result.data?.response) {
        setResponses((current) =>
          sortResponses([...current, result.data!.response]),
        );
        form.reset();
        setShowCreateForm(false);
        addToast({
          variant: "success",
          title: "Réponse enregistrée.",
        });
      } else if (!result.success) {
        addToast({
          variant: "error",
          title: result.message,
        });
      }
    },
    [addToast],
  );

  const handleUpdate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>, responseId: string) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      setUpdatePendingId(responseId);
      const result = await updateSavedResponseAction(formData);
      setUpdatePendingId(null);
      if (!result) return;
      if (result.success && result.data?.response) {
        setResponses((current) =>
          sortResponses(
            current.map((entry) =>
              entry.id === responseId ? result.data!.response : entry,
            ),
          ),
        );
        setExpandedId(null);
        addToast({
          variant: "success",
          title: "Réponse mise à jour.",
        });
      } else if (!result.success) {
        addToast({
          variant: "error",
          title: result.message,
        });
      }
    },
    [addToast],
  );

  const handleDelete = useCallback(
    async (responseId: string) => {
      if (!confirm("Supprimer cette réponse enregistrée ?")) {
        return;
      }
      const formData = new FormData();
      formData.append("responseId", responseId);
      setDeletePendingId(responseId);
      const result = await deleteSavedResponseAction(formData);
      setDeletePendingId(null);
      if (!result) return;
      if (result.success && result.data?.id) {
        setResponses((current) =>
          current.filter((entry) => entry.id !== responseId),
        );
        if (expandedId === responseId) {
          setExpandedId(null);
        }
        addToast({
          variant: "success",
          title: "Réponse supprimée.",
        });
      } else if (!result.success) {
        addToast({
          variant: "error",
          title: result.message,
        });
      }
    },
    [addToast, expandedId],
  );

  const emptyState = responses.length === 0;

  const renderDescription = useCallback((response: SavedResponse) => {
    if (response.description && response.description.length > 0) {
      return response.description;
    }
    return response.format === "HTML"
      ? "Modèle HTML enregistré"
      : "Modèle texte enregistré";
  }, []);

  const sortedResponses = useMemo(() => sortResponses(responses), [responses]);

  return (
    <section
      id="saved-responses"
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Réponses enregistrées
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Créez des modèles réutilisables pour accélérer vos échanges
            professionnels.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowCreateForm((value) => !value)}
        >
          {showCreateForm ? "Fermer" : "Nouvelle réponse"}
        </Button>
      </div>

      {showCreateForm ? (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950/40"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Nom du modèle
              </label>
              <Input name="title" placeholder="Relance devis, confirmation..." required />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Format
              </label>
              <Select name="format" defaultValue="PLAINTEXT">
                <option value="PLAINTEXT">Texte brut</option>
                <option value="HTML">HTML</option>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Description (facultatif)
              </label>
              <Input
                name="description"
                placeholder="Résumé interne du modèle"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Contenu
              </label>
              <Textarea
                name="content"
                rows={8}
                placeholder="Bonjour..."
                required
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Pour le HTML, utilisez des styles inline (compatible avec la plupart des messageries).
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreateForm(false)}
            >
              Annuler
            </Button>
            <Button type="submit" loading={createPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : null}

      {emptyState ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Aucun modèle enregistré pour le moment. Créez votre première réponse personnalisée ou personnalisez les modèles fournis.
        </p>
      ) : (
        <div className="space-y-4">
          {sortedResponses.map((response) => (
            <div
              key={response.id}
              className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-950/40"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {response.title}
                    </span>
                    <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
                      {FORMAT_LABELS[response.format]}
                    </span>
                    {response.builtIn ? (
                      <Badge variant="info">Modèle par défaut</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {renderDescription(response)}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Dernière mise à jour&nbsp;: {formatter.format(new Date(response.updatedAt))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setExpandedId((current) =>
                        current === response.id ? null : response.id,
                      )
                    }
                  >
                    Modifier
                  </Button>
                  {!response.builtIn ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                      onClick={() => void handleDelete(response.id)}
                      loading={deletePendingId === response.id}
                    >
                      Supprimer
                    </Button>
                  ) : null}
                </div>
              </div>
              {expandedId === response.id ? (
                <form
                  onSubmit={(event) => void handleUpdate(event, response.id)}
                  className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <input type="hidden" name="responseId" value={response.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        Nom du modèle
                      </label>
                      <Input
                        name="title"
                        defaultValue={response.title}
                        required
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        Format
                      </label>
                      <Select name="format" defaultValue={response.format}>
                        <option value="PLAINTEXT">Texte brut</option>
                        <option value="HTML">HTML</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        Description
                      </label>
                      <Input
                        name="description"
                        defaultValue={response.description ?? ""}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        Contenu
                      </label>
                      <Textarea
                        name="content"
                        defaultValue={response.content}
                        rows={9}
                        required
                        className={response.format === "HTML" ? "font-mono" : undefined}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setExpandedId(null)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      loading={updatePendingId === response.id}
                    >
                      Enregistrer
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

