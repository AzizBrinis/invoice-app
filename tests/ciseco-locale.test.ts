import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  formatCisecoDate,
  translateCisecoText,
} from "@/components/website/templates/ecommerce-ciseco/locale";

const ROOT = process.cwd();
const LOCALE_PATH = path.join(
  ROOT,
  "src/components/website/templates/ecommerce-ciseco/locale.ts",
);
const SCAN_ROOTS = [
  "src/components/website/templates/ecommerce-ciseco",
  "src/app/api/catalogue",
];

function walk(relativePath: string): string[] {
  const absolutePath = path.join(ROOT, relativePath);
  const stats = fs.statSync(absolutePath);
  if (stats.isDirectory()) {
    return fs
      .readdirSync(absolutePath)
      .flatMap((entry) => walk(path.join(relativePath, entry)));
  }

  return /\.(ts|tsx)$/.test(relativePath) ? [relativePath] : [];
}

function extractLocaleKeys() {
  const source = fs.readFileSync(LOCALE_PATH, "utf8");
  const keys = new Set<string>();

  for (const match of source.matchAll(/^\s*"([^"]+)":/gm)) {
    keys.add(match[1]);
  }

  for (const match of source.matchAll(/^\s*([A-Za-z][A-Za-z0-9 ]*[A-Za-z0-9])\s*:/gm)) {
    keys.add(match[1]);
  }

  return keys;
}

function extractTranslationCalls(relativePath: string) {
  const absolutePath = path.join(ROOT, relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const entries: Array<{ key: string; ref: string }> = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === "t") {
      const [firstArg] = node.arguments;
      if (
        firstArg &&
        (ts.isStringLiteral(firstArg) ||
          ts.isNoSubstitutionTemplateLiteral(firstArg))
      ) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          firstArg.getStart(sourceFile),
        );
        entries.push({
          key: firstArg.text,
          ref: `${relativePath}:${line + 1}`,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return entries;
}

describe("ciseco locale coverage", () => {
  it("covers every literal translation key used by the template and catalogue routes", () => {
    const localeKeys = extractLocaleKeys();
    const files = SCAN_ROOTS.flatMap(walk);
    const missing = files
      .flatMap(extractTranslationCalls)
      .filter((entry) => !localeKeys.has(entry.key))
      .map((entry) => `${entry.key} (${entry.ref})`);

    expect(missing).toEqual([]);
  });

  it("translates key French-mode account and order strings", () => {
    expect(translateCisecoText("fr", "Account information")).toBe(
      "Informations du compte",
    );
    expect(translateCisecoText("fr", "Password updated successfully.")).toBe(
      "Mot de passe mis à jour avec succès.",
    );
    expect(translateCisecoText("fr", "Preview mode: no quote request recorded.")).toBe(
      "Mode aperçu : aucune demande de devis n'est enregistrée.",
    );
    expect(translateCisecoText("fr", "Free shipping")).toBe(
      "Livraison gratuite",
    );
    expect(translateCisecoText("fr", "{{reviewCount}} Reviews")).toBe(
      "{{reviewCount}} avis",
    );
  });

  it("maps French-origin server messages back to English", () => {
    expect(translateCisecoText("en", "Site indisponible.")).toBe(
      "Site unavailable.",
    );
    expect(translateCisecoText("en", "Commande introuvable")).toBe(
      "Order not found",
    );
  });

  it("formats dates for the active locale", () => {
    expect(formatCisecoDate("en", "2025-03-22")).toBe("Mar 22, 2025");
    expect(formatCisecoDate("fr", "2025-03-22", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })).toContain("mars");
  });
});
