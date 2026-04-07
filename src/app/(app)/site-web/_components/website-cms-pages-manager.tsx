"use client";

import clsx from "clsx";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteWebsiteCmsPageAction,
  saveWebsiteCmsPageAction,
} from "@/app/(app)/site-web/actions";
import {
  INITIAL_WEBSITE_CMS_PAGE_FORM_STATE,
  type WebsiteCmsPageRecord,
} from "@/app/(app)/site-web/form-state";
import { slugify } from "@/lib/slug";

type WebsiteCmsPagesManagerProps = {
  initialPages: WebsiteCmsPageRecord[];
  websiteSlug: string;
};

type CmsPageDraft = {
  id: string | null;
  title: string;
  path: string;
  content: string;
  showInFooter: boolean;
};

type DeleteFeedback = {
  status: "idle" | "success" | "error";
  message?: string;
};

const EMPTY_DRAFT: CmsPageDraft = {
  id: null,
  title: "",
  path: "",
  content: "",
  showInFooter: false,
};

function buildDraftFromPage(page: WebsiteCmsPageRecord): CmsPageDraft {
  return {
    id: page.id,
    title: page.title,
    path: page.path,
    content: page.content,
    showInFooter: page.showInFooter,
  };
}

function normalizeDisplayPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/ma-page";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function formatUpdatedAt(value: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function WebsiteCmsPagesManager({
  initialPages,
  websiteSlug,
}: WebsiteCmsPagesManagerProps) {
  const [state, formAction] = useActionState(
    saveWebsiteCmsPageAction,
    INITIAL_WEBSITE_CMS_PAGE_FORM_STATE,
  );
  const [pages, setPages] = useState(initialPages);
  const [draft, setDraft] = useState<CmsPageDraft>(EMPTY_DRAFT);
  const [pathTouched, setPathTouched] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<DeleteFeedback>({
    status: "idle",
  });
  const [isDeleting, startDeleteTransition] = useTransition();

  useEffect(() => {
    setPages(initialPages);
  }, [initialPages]);

  useEffect(() => {
    if (!state.pages) {
      return;
    }

    setPages(state.pages);

    if (state.savedPageId) {
      const savedPage = state.pages.find((page) => page.id === state.savedPageId);
      if (savedPage) {
        setDraft(buildDraftFromPage(savedPage));
        setPathTouched(true);
      }
    }
  }, [state]);

  const footerCount = useMemo(
    () => pages.filter((page) => page.showInFooter).length,
    [pages],
  );
  const selectedPage = useMemo(
    () => pages.find((page) => page.id === draft.id) ?? null,
    [draft.id, pages],
  );
  const fieldErrors = state.fieldErrors ?? {};

  const resetDraft = () => {
    setDraft(EMPTY_DRAFT);
    setPathTouched(false);
  };

  const handleTitleChange = (value: string) => {
    setDraft((current) => {
      if (current.id || pathTouched) {
        return {
          ...current,
          title: value,
        };
      }

      const nextSlug = slugify(value);
      return {
        ...current,
        title: value,
        path: nextSlug ? `/${nextSlug}` : "",
      };
    });
  };

  const handleDelete = (page: WebsiteCmsPageRecord) => {
    if (
      !window.confirm(
        `Supprimer définitivement la page “${page.title}” ?`,
      )
    ) {
      return;
    }

    setDeleteFeedback({ status: "idle" });

    startDeleteTransition(async () => {
      const result = await deleteWebsiteCmsPageAction(page.id);
      setDeleteFeedback({
        status: result.status,
        message: result.message,
      });

      if (result.pages) {
        setPages(result.pages);
      }

      if (draft.id === page.id) {
        resetDraft();
      }
    });
  };

  return (
    <section className="card space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Pages de contenu (CMS)
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Créez vos pages d’information, CGV, livraison, mentions légales ou
            toute autre page éditoriale du template Ciesco Home Clone.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{pages.length} page(s)</span>
          <span>•</span>
          <span>{footerCount} visible(s) dans le footer</span>
        </div>
      </div>

      {state.status === "error" && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert variant="success" title={state.message} />
      ) : null}
      {deleteFeedback.status !== "idle" && deleteFeedback.message ? (
        <Alert
          variant={deleteFeedback.status === "success" ? "success" : "error"}
          title={deleteFeedback.message}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Bibliotheque CMS
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Selectionnez une page pour la modifier.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={resetDraft}>
                Nouvelle page
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {pages.length ? (
                pages.map((page) => {
                  const isSelected = page.id === draft.id;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => {
                        setDraft(buildDraftFromPage(page));
                        setPathTouched(true);
                        setDeleteFeedback({ status: "idle" });
                      }}
                      className={clsx(
                        "w-full rounded-2xl border px-4 py-3 text-left transition",
                        isSelected
                          ? "border-zinc-900 bg-white shadow-sm dark:border-zinc-200 dark:bg-zinc-900"
                          : "border-zinc-200 bg-white/80 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {page.title}
                          </p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {page.path}
                          </p>
                        </div>
                        {page.showInFooter ? (
                          <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-zinc-100 dark:text-zinc-900">
                            Footer
                          </span>
                        ) : null}
                      </div>
                      {page.excerpt ? (
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                          {page.excerpt}
                        </p>
                      ) : null}
                      <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                        Mis a jour le {formatUpdatedAt(page.updatedAt)}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  Ajoutez une premiere page comme <span className="font-medium text-zinc-700 dark:text-zinc-200">/delivery</span>, <span className="font-medium text-zinc-700 dark:text-zinc-200">/secure-payment</span> ou <span className="font-medium text-zinc-700 dark:text-zinc-200">/mentions-legales</span>.
                </div>
              )}
            </div>
          </div>
        </div>

        <form action={formAction} className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
          <input type="hidden" name="id" value={draft.id ?? ""} />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {draft.id ? "Modifier la page CMS" : "Nouvelle page CMS"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                URL publique: {formatDisplayUrl(websiteSlug, draft.path)}
              </p>
            </div>
            {selectedPage ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isDeleting}
                onClick={() => handleDelete(selectedPage)}
              >
                {isDeleting ? "Suppression..." : "Supprimer"}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="cms-title" className="label">
                Titre de la page
              </label>
              <Input
                id="cms-title"
                name="title"
                value={draft.title}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="Conditions generales de vente"
                aria-invalid={Boolean(fieldErrors.title) || undefined}
              />
              {fieldErrors.title ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.title}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="cms-path" className="label">
                URL / slug
              </label>
              <Input
                id="cms-path"
                name="path"
                value={draft.path}
                onChange={(event) => {
                  setPathTouched(true);
                  setDraft((current) => ({
                    ...current,
                    path: event.target.value,
                  }));
                }}
                placeholder="/conditions-generales-de-vente"
                aria-invalid={Boolean(fieldErrors.path) || undefined}
              />
              {fieldErrors.path ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {fieldErrors.path}
                </p>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Exemple: /delivery, /about-us, /mentions-legales
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="cms-content" className="label">
              Contenu
            </label>
            <Textarea
              id="cms-content"
              name="content"
              rows={18}
              value={draft.content}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  content: event.target.value,
                }))}
              placeholder={[
                "# Livraison",
                "",
                "Indiquez ici vos delais, zones de livraison et conditions.",
                "",
                "## Delais",
                "- 24 a 48h en Tunisie",
                "- 3 a 5 jours a l'international",
              ].join("\n")}
              aria-invalid={Boolean(fieldErrors.content) || undefined}
            />
            {fieldErrors.content ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.content}
              </p>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Titres Markdown simples (#, ##), paragraphes, listes (-, 1.),
                citations (&gt;) et HTML simple sont pris en charge.
              </p>
            )}
          </div>

          <label className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200">
            <input
              type="checkbox"
              name="showInFooter"
              className="checkbox"
              checked={draft.showInFooter}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  showInFooter: event.target.checked,
                }))}
            />
            Afficher cette page dans le footer du template
          </label>

          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-4 text-xs leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              Conseils de mise en page
            </p>
            <p>
              Structurez les longues pages avec des titres courts, des sections
              claires et des listes concises. Les pages publiques utilisent une
              mise en page editoriale elegante avec une lecture optimisee sur
              mobile, tablette et desktop.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {draft.id ? (
              <Button type="button" variant="secondary" onClick={resetDraft}>
                Creer une nouvelle page
              </Button>
            ) : null}
            <FormSubmitButton className="w-full sm:w-auto">
              {draft.id ? "Enregistrer la page" : "Creer la page"}
            </FormSubmitButton>
          </div>
        </form>
      </div>
    </section>
  );
}

function formatDisplayUrl(websiteSlug: string, path: string) {
  return `/catalogue/${websiteSlug}${normalizeDisplayPath(path)}`;
}
