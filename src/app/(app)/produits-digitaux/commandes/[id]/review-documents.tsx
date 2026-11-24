"use client";

import { useState } from "react";

export type ReviewDocument = { id: string; title: string; href: string };

/** One tab per PDF (invoice, then each licence), rendered by the browser's PDF viewer. */
export function ReviewDocuments({ documents }: { documents: ReviewDocument[] }) {
  const [active, setActive] = useState(0);
  const current = documents[active];
  if (!current) return null;
  return (
    <div>
      <div role="tablist" aria-label="Documents joints" className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {documents.map((doc, index) => (
          <button
            key={doc.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={`-mb-px rounded-t-md border px-3 py-2 text-sm ${
              index === active
                ? "border-zinc-200 border-b-white bg-white font-medium text-zinc-900 dark:border-zinc-800 dark:border-b-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                : "border-transparent text-blue-600 hover:text-blue-700 dark:text-blue-400"
            }`}
          >
            {doc.title}
          </button>
        ))}
      </div>
      <iframe
        key={current.href}
        title={current.title}
        src={current.href}
        className="h-[75vh] min-h-[480px] w-full rounded-b-md border border-t-0 border-zinc-200 bg-zinc-600 dark:border-zinc-800"
      />
      <p className="mt-2 text-sm">
        <a className="text-blue-600 hover:underline dark:text-blue-400" href={current.href} target="_blank" rel="noopener noreferrer">
          Ouvrir dans un nouvel onglet
        </a>
      </p>
    </div>
  );
}
