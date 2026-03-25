import fs from "node:fs";
import path from "node:path";

const env = process.env as Record<string, string | undefined>;

function loadEnvFile(filepath: string) {
  const content = fs.readFileSync(filepath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && env[key] === undefined) {
      env[key] = value;
    }
  }
}

const testEnvPath = path.resolve(process.cwd(), ".env.test");
if (fs.existsSync(testEnvPath)) {
  loadEnvFile(testEnvPath);
}

if (process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

if (!process.env.SHADOW_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.SHADOW_DATABASE_URL = process.env.DATABASE_URL;
}

if (!process.env.NODE_ENV) {
  env.NODE_ENV = "test";
}

if (!process.env.APP_URL && !process.env.NEXT_PUBLIC_APP_URL) {
  process.env.APP_URL = "http://localhost:3000";
}
