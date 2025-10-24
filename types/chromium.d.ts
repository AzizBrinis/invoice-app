declare module "@sparticuz/chromium-min" {
  import type { Viewport } from "puppeteer";

  interface ChromiumModule {
    args: string[];
    defaultViewport?: Viewport | null;
    executablePath(): Promise<string | null>;
    headless?: boolean | "new";
  }

  const chromium: ChromiumModule;
  export default chromium;
}
