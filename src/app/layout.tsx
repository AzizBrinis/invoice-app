import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  ThemeProvider,
  ThemeScript,
  type Theme,
} from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Application de facturation",
  description:
    "Gérez vos devis, factures, clients et paiements dans une interface moderne en français.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const isTheme = (value: string | undefined): value is Theme =>
    value === "light" || value === "dark" || value === "system";
  const initialTheme: Theme = isTheme(themeCookie) ? themeCookie : "system";
  const requestHeaders = await headers();
  const headerTheme = requestHeaders.get("sec-ch-prefers-color-scheme");
  const isResolvedTheme = (
    value: string | null,
  ): value is "light" | "dark" => value === "light" || value === "dark";
  const initialResolvedTheme: "light" | "dark" =
    initialTheme === "system"
      ? isResolvedTheme(headerTheme)
        ? headerTheme
        : "light"
      : initialTheme;

  return (
    <html
      lang="fr"
      data-theme={initialTheme}
      data-theme-resolved={initialResolvedTheme}
      className={initialResolvedTheme === "dark" ? "dark" : undefined}
      style={{ colorScheme: initialResolvedTheme }}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-50 text-zinc-900 antialiased transition-colors dark:bg-zinc-950 dark:text-zinc-100`}
        data-theme={initialTheme}
        data-theme-resolved={initialResolvedTheme}
        style={{ colorScheme: initialResolvedTheme }}
        suppressHydrationWarning
      >
        <ThemeScript />
        <ToastProvider>
          <ThemeProvider initialTheme={initialTheme}>
            {children}
          </ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
