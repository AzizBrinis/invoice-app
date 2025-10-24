import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Browser } from "puppeteer";
import type { Mock } from "vitest";

const executablePathMock = vi.fn(async () => "/opt/chromium");

vi.mock("@sparticuz/chromium-min", () => ({
  __esModule: true,
  default: {
    args: ["--from-chromium"],
    defaultViewport: { width: 1280, height: 720 },
    executablePath: executablePathMock,
    headless: "new",
  },
}));

vi.mock("puppeteer", () => ({
  __esModule: true,
  default: {
    launch: vi.fn(),
  },
}));

import puppeteer from "puppeteer";
import { __pdfInternal } from "@/server/pdf";

const launchMock = puppeteer.launch as unknown as Mock;

describe("PDF browser launcher", () => {
  let consoleErrorMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    __pdfInternal.resetCaches();
    consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
  });

  it("uses the default puppeteer binary when launch succeeds", async () => {
    const fakeBrowser = { close: vi.fn() } as unknown as Browser;
    launchMock.mockResolvedValueOnce(fakeBrowser);

    const browser = await __pdfInternal.createBrowser({ preferBundledChromium: false });

    expect(browser).toBe(fakeBrowser);
    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(launchMock.mock.calls[0]?.[0]).toMatchObject({
      headless: "new",
    });
    expect(executablePathMock).not.toHaveBeenCalled();
  });

  it("falls back to bundled Chromium when the default binary fails", async () => {
    const fakeBrowser = { close: vi.fn() } as unknown as Browser;
    launchMock.mockRejectedValueOnce(new Error("libatk.so.1: cannot open shared object file"));
    launchMock.mockResolvedValueOnce(fakeBrowser);

    const browser = await __pdfInternal.createBrowser({ preferBundledChromium: false });

    expect(browser).toBe(fakeBrowser);
    expect(launchMock).toHaveBeenCalledTimes(2);
    expect(executablePathMock).toHaveBeenCalledTimes(1);
    const fallbackArgs = launchMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(fallbackArgs.executablePath).toBe("/opt/chromium");
    expect(fallbackArgs.args).toContain("--from-chromium");
  });

  it("prioritises bundled Chromium when requested", async () => {
    const fakeBrowser = { close: vi.fn() } as unknown as Browser;
    launchMock.mockResolvedValueOnce(fakeBrowser);

    const browser = await __pdfInternal.createBrowser({ preferBundledChromium: true });

    expect(browser).toBe(fakeBrowser);
    expect(launchMock).toHaveBeenCalledTimes(1);
    const firstCall = launchMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstCall.executablePath).toBe("/opt/chromium");
  });
});
