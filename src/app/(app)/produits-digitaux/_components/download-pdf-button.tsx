"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Plain download link; refreshes the page afterwards so statuses update. */
export function DownloadPdfButton({ href }: { href: string }) {
  const router = useRouter();
  return (
    <Button asChild className="w-full sm:w-auto">
      <a href={href} download onClick={() => window.setTimeout(() => router.refresh(), 4000)}>
        <Download className="h-4 w-4" aria-hidden="true" /> Télécharger le PDF
      </a>
    </Button>
  );
}
