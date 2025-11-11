import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

const REQUIRED_ENV_KEYS = ["DATABASE_URL", "DIRECT_URL", "SHADOW_DATABASE_URL"];

function stripWrappingQuotes(value: string) {
  if (!value) return "";
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvIfNeeded() {
  const missingKey = REQUIRED_ENV_KEYS.some((key) => !process.env[key]);
  if (!missingKey) {
    return;
  }

  const envFiles = [".env.local", ".env"];
  for (const filename of envFiles) {
    const envPath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(envPath)) {
      continue;
    }
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) {
        continue;
      }
      const [key, ...rest] = line.split("=");
      if (!key) {
        continue;
      }
      const trimmedKey = key.trim();
      if (!trimmedKey || process.env[trimmedKey]) {
        continue;
      }
      process.env[trimmedKey] = stripWrappingQuotes(rest.join("=").trim());
    }
  }
}

loadEnvIfNeeded();

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
