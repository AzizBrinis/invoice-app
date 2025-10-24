import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfGenerationError, __pdfTesting } from "@/server/pdf";

const { launchMock, executablePathMock } = vi.hoisted(() => ({
  launchMock: vi.fn(),
  executablePathMock: vi.fn(),
}));

vi.mock("puppeteer", () => ({
  __esModule: true,
  default: {
    launch: launchMock,
  },
}));

vi.mock(
  "@sparticuz/chromium",
  () => ({
    __esModule: true,
    default: {
      args: ["--single-process"],
      defaultViewport: { width: 800, height: 600 },
      headless: true,
      executablePath: executablePathMock,
    },
  }),
  { virtual: true },
);

afterEach(() => {
  launchMock.mockReset();
  executablePathMock.mockReset();
  delete process.env.PDF_FORCE_BUNDLED_CHROMIUM;
  __pdfTesting.resetBrowser();
});

describe("PDF renderer infrastructure", () => {
  it("falls back to bundled chromium when default launch fails", async () => {
    executablePathMock.mockResolvedValue("/tmp/chromium");
    const mockBrowser = { close: vi.fn() } as unknown as Awaited<
      ReturnType<typeof __pdfTesting.getBrowser>
    >;

    launchMock
      .mockRejectedValueOnce(
        new Error("error while loading shared libraries: libatk-1.0.so.0"),
      )
      .mockResolvedValueOnce(mockBrowser);

    const browser = await __pdfTesting.getBrowser();

    expect(browser).toBe(mockBrowser);
    expect(launchMock).toHaveBeenCalledTimes(2);
    const fallbackArgs = launchMock.mock.calls[1]?.[0] as {
      executablePath?: string;
      args?: string[];
    };
    expect(fallbackArgs.executablePath).toBe("/tmp/chromium");
    expect(fallbackArgs.args).toEqual(
      expect.arrayContaining(["--single-process"]),
    );
  });

  it("surfaces a descriptive error when all launchers fail", async () => {
    executablePathMock.mockResolvedValue("/tmp/chromium");
    launchMock.mockRejectedValue(new Error("libatk missing"));

    await expect(__pdfTesting.getBrowser()).rejects.toBeInstanceOf(
      PdfGenerationError,
    );
  });
});
