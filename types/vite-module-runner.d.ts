import type { ModuleRunnerImportMeta } from "vite/module-runner";

declare module "vite/module-runner" {
  interface ModuleRunnerOptions {
    /**
     * Optional factory used by Vitest to customize the generated `import.meta`.
     * The upstream type d.ts currently omits this field, so we declare it here
     * to keep dependency versions compatible.
     */
    createImportMeta?: (
      url: string,
      context?: Record<string, unknown>,
    ) => ModuleRunnerImportMeta;
  }
}
