import type { ReactNode } from "react";
import Link from "next/link";
import { MailPlus } from "lucide-react";

export default function MessagerieLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <Link
        href="/messagerie/nouveau-message"
        className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:ring-blue-300"
        aria-label="Composer un nouveau message"
      >
        <MailPlus className="h-5 w-5" />
      </Link>
    </div>
  );
}
