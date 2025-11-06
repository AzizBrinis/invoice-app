import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import {
  ThemeProvider,
  ThemeScript,
  type Theme,
} from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

const geistSans = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [
    { path: "./fonts/geist/Geist-100.ttf", weight: "100", style: "normal" },
    { path: "./fonts/geist/Geist-200.ttf", weight: "200", style: "normal" },
    { path: "./fonts/geist/Geist-300.ttf", weight: "300", style: "normal" },
    { path: "./fonts/geist/Geist-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist/Geist-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist/Geist-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/geist/Geist-700.ttf", weight: "700", style: "normal" },
    { path: "./fonts/geist/Geist-800.ttf", weight: "800", style: "normal" },
    { path: "./fonts/geist/Geist-900.ttf", weight: "900", style: "normal" },
  ],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [
    {
      path: "./fonts/geist-mono/GeistMono-100.ttf",
      weight: "100",
      style: "normal",
    },
    {
      path: "./fonts/geist-mono/GeistMono-200.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "./fonts/geist-mono/GeistMono-300.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/geist-mono/GeistMono-400.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/geist-mono/GeistMono-500.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/geist-mono/GeistMono-600.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/geist-mono/GeistMono-700.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/geist-mono/GeistMono-800.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "./fonts/geist-mono/GeistMono-900.ttf",
      weight: "900",
      style: "normal",
    },
  ],
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
