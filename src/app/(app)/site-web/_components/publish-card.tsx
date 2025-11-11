"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { updateWebsitePublishingAction } from "@/app/(app)/site-web/actions";

type PublishCardProps = {
  published: boolean;
  slugUrl: string;
  previewUrl: string;
};

export function PublishCard({
  published,
  slugUrl,
  previewUrl,
}: PublishCardProps) {
  const [pending, startTransition] = useTransition();
  const [localState, setLocalState] = useState<"published" | "unpublished">(
    published ? "published" : "unpublished",
  );
  const [pendingAction, setPendingAction] = useState<
    "publish" | "unpublish" | null
  >(null);

  function togglePublish(next: boolean) {
    setPendingAction(next ? "publish" : "unpublish");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("published", String(next));
        await updateWebsitePublishingAction(formData);
        setLocalState(next ? "published" : "unpublished");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Publication
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Activez votre site pour le rendre public sur l’URL slug ou sur votre
          domaine. Prévisualisez à tout moment avant de publier.
        </p>
      </div>
      <Alert
        variant={localState === "published" ? "success" : "warning"}
        title={
          localState === "published"
            ? "Votre catalogue est en ligne."
            : "Votre catalogue est privé."
        }
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <a href={previewUrl} target="_blank" rel="noreferrer">
            Ouvrir la prévisualisation
          </a>
        </Button>
        <Button asChild variant="ghost">
          <a href={slugUrl} target="_blank" rel="noreferrer">
            Voir l’URL slug
          </a>
        </Button>
      </div>
      <div className="flex gap-3">
        <Button
          type="button"
          onClick={() => togglePublish(true)}
          disabled={pending || localState === "published"}
          loading={pending && pendingAction === "publish"}
        >
          Publier
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => togglePublish(false)}
          disabled={pending || localState === "unpublished"}
          loading={pending && pendingAction === "unpublish"}
        >
          Dépublier
        </Button>
      </div>
    </div>
  );
}
