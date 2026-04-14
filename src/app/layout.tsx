import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getAppBaseUrl } from "@/lib/env";

const geistSans = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [
    { path: "./fonts/geist/Geist-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist/Geist-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist/Geist-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/geist/Geist-700.ttf", weight: "700", style: "normal" },
  ],
});

function resolveMetadataBase() {
  try {
    return new URL(getAppBaseUrl());
  } catch {
    if (process.env.VERCEL_URL) {
      return new URL(`https://${process.env.VERCEL_URL}`);
    }
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "Application de facturation",
  description:
    "Gérez vos devis, factures, clients et paiements dans une interface moderne en français.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      data-theme="system"
      data-theme-resolved="light"
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} min-h-screen bg-zinc-50 text-zinc-900 antialiased transition-colors dark:bg-zinc-950 dark:text-zinc-100`}
        data-theme="system"
        data-theme-resolved="light"
        style={{ colorScheme: "light" }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
