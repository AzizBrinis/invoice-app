import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { PrefetchLink } from "@/components/ui/prefetch-link";

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
  summary?: string;
};

export function PaginationControls({
  page,
  pageCount,
  buildHref,
  summary,
}: PaginationControlsProps) {
  if (pageCount <= 1 && !summary) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {summary ?? `Page ${page} sur ${pageCount}`}
      </p>
      {pageCount > 1 ? (
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="ghost" disabled>
              Précédent
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <PrefetchLink href={buildHref(page - 1) as Route}>
                Précédent
              </PrefetchLink>
            </Button>
          )}
          {page >= pageCount ? (
            <Button variant="ghost" disabled>
              Suivant
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <PrefetchLink href={buildHref(page + 1) as Route}>
                Suivant
              </PrefetchLink>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
