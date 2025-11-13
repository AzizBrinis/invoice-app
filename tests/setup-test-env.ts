import fs from "node:fs";
import path from "node:path";

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
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
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
