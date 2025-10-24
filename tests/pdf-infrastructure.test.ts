import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("puppeteer", () => {
  return {
    default: {
      launch: vi.fn(),
    },
  };
});

import puppeteer from "puppeteer";

const launchMock = puppeteer.launch as unknown as ReturnType<typeof vi.fn>;

function stubFetch(response: Partial<Response>) {
  const resolvedResponse = {
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => "",
    ...response,
  } as Response;
  vi.stubGlobal("fetch", vi.fn(async () => resolvedResponse));
}

function stubFetchReject(error: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw error;
    }),
  );
}

describe("PDF infrastructure", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    launchMock.mockReset();
    delete process.env.PDF_RENDERER;
    delete process.env.PDF_RENDER_SERVICE_URL;
  });

  it("uses the remote renderer when forced", async () => {
    process.env.PDF_RENDERER = "remote";
    process.env.PDF_RENDER_SERVICE_URL = "https://pdf.example.com/render";

    const pdfBytes = new TextEncoder().encode("pdf");
    stubFetch({
      ok: true,
      status: 200,
      arrayBuffer: async () => pdfBytes.buffer,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { renderPdfFromHtml, resetPdfRendererForTests } = await import("@/server/pdf");
    resetPdfRendererForTests();

    const buffer = await renderPdfFromHtml("<html></html>");

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBe(pdfBytes.byteLength);
    expect(launchMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://pdf.example.com/render",
      expect.objectContaining({ method: "POST" }),
    );

    consoleSpy.mockRestore();
  });

  it("falls back to the remote renderer when Puppeteer fails", async () => {
    process.env.PDF_RENDER_SERVICE_URL = "https://pdf.example.com/render";

    launchMock.mockRejectedValue(new Error("libatk missing"));

    const pdfBytes = new Uint8Array([1, 2, 3]);
    stubFetch({
      ok: true,
      status: 200,
      arrayBuffer: async () => pdfBytes.buffer,
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { renderPdfFromHtml, resetPdfRendererForTests } = await import("@/server/pdf");
    resetPdfRendererForTests();

    const buffer = await renderPdfFromHtml("<html></html>");

    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(buffer.equals(Buffer.from(pdfBytes))).toBe(true);

    consoleSpy.mockRestore();
  });

  it("throws a descriptive error when the remote renderer fails", async () => {
    process.env.PDF_RENDER_SERVICE_URL = "https://pdf.example.com/render";

    launchMock.mockRejectedValue(new Error("libatk missing"));

    stubFetch({
      ok: false,
      status: 503,
      text: async () => "service down",
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { renderPdfFromHtml, PdfGenerationError, resetPdfRendererForTests } = await import("@/server/pdf");
    resetPdfRendererForTests();

    await expect(renderPdfFromHtml("<html></html>")).rejects.toBeInstanceOf(PdfGenerationError);

    consoleSpy.mockRestore();
  });

  it("propagates a configuration error when remote mode lacks an endpoint", async () => {
    process.env.PDF_RENDERER = "remote";

    stubFetchReject(new Error("network"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { renderPdfFromHtml, PdfGenerationError, resetPdfRendererForTests } = await import("@/server/pdf");
    resetPdfRendererForTests();

    await expect(renderPdfFromHtml("<html></html>")).rejects.toBeInstanceOf(PdfGenerationError);
    expect(launchMock).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
