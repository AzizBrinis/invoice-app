#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off"]);

function parseBoolean(value) {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (TRUTHY.has(normalized)) {
    return true;
  }
  if (FALSY.has(normalized)) {
    return false;
  }
  return null;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      shell: process.platform === "win32",
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }

      const error = new Error(`Command "${command} ${args.join(" ")}" exited with code ${code}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function loadLocalEnvIfNeeded() {
  if (process.env.DATABASE_URL && process.env.DIRECT_URL) {
    return;
  }

  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
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
    if (trimmedKey.length === 0 || Object.prototype.hasOwnProperty.call(process.env, trimmedKey)) {
      continue;
    }

    const value = rest.join("=").trim();
    process.env[trimmedKey] = stripWrappingQuotes(value);
  }
}

function stripWrappingQuotes(value) {
  if (!value) {
    return "";
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function shouldSkipMigrations() {
  const explicitSkip =
    parseBoolean(process.env.SKIP_PRISMA_MIGRATE_ON_BUILD) ??
    parseBoolean(process.env.PRISMA_SKIP_MIGRATE_ON_BUILD);

  if (explicitSkip === true) {
    return true;
  }

  const explicitForce = parseBoolean(process.env.FORCE_PRISMA_MIGRATE_ON_BUILD);
  if (explicitForce === true) {
    return false;
  }

  return false;
}

function canIgnoreMigrationError(error) {
  const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
  return /P1001/.test(output) || /Can't reach database server/i.test(output);
}

async function main() {
  loadLocalEnvIfNeeded();

  await run("prisma", ["generate"]);

  if (shouldSkipMigrations()) {
    console.log("Skipping Prisma migrations (SKIP_PRISMA_MIGRATE_ON_BUILD is enabled).");
  } else {
    try {
      await run("prisma", ["migrate", "deploy"]);
    } catch (error) {
      const allowSkip =
        parseBoolean(process.env.ALLOW_MIGRATION_SKIP_ON_BUILD) ??
        parseBoolean(process.env.PRISMA_ALLOW_MIGRATION_SKIP_ON_BUILD);

      if (allowSkip === false || !canIgnoreMigrationError(error)) {
        throw error;
      }

      console.warn("");
      console.warn("⚠️  Prisma migrations were skipped because the database is unreachable.");
      console.warn("   → Run `npm run prisma:deploy` from a machine that can reach the database");
      console.warn("     (local VPN, GitHub Action, Supabase SQL editor, etc.) before deploying.");
      console.warn("");
    }
  }

  await run("next", ["build"]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = typeof error.code === "number" ? error.code : 1;
});
