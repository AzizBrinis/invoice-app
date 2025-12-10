import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const mockCallGeminiGenerateContent = vi.fn();
const mockCallOpenAIChatCompletion = vi.fn();

vi.mock("@/server/assistant/providers/gemini", () => ({
  callGeminiGenerateContent: mockCallGeminiGenerateContent,
}));

vi.mock("@/server/assistant/providers/openai", () => ({
  callOpenAIChatCompletion: mockCallOpenAIChatCompletion,
}));

const ORIGINAL_ENV = { ...process.env };

async function loadCallSelectedModel() {
  const module = await import("@/server/assistant/providers");
  return module.callSelectedModel;
}

describe("callSelectedModel provider fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCallGeminiGenerateContent.mockReset();
    mockCallOpenAIChatCompletion.mockReset();
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, ORIGINAL_ENV);
    process.env.AI_MODEL_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.OPENAI_API_KEY = "openai-key";
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("falls back to OpenAI when Gemini is temporarily unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCallGeminiGenerateContent.mockRejectedValue(
      new Error(
        'Gemini API error: 503 Service Unavailable {"status":"UNAVAILABLE","message":"The model is overloaded. Please try again later."}',
      ),
    );
    const fallbackResponse = {
      content: "fallback",
      toolCalls: [],
    };
    mockCallOpenAIChatCompletion.mockResolvedValue(fallbackResponse);

    const callSelectedModel = await loadCallSelectedModel();
    const result = await callSelectedModel({ messages: [], tools: [] });

    expect(mockCallGeminiGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockCallOpenAIChatCompletion).toHaveBeenCalledTimes(1);
    expect(result).toBe(fallbackResponse);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("Gemini indisponible");

    warnSpy.mockRestore();
  });

  it("rethrows Gemini errors that are not transient", async () => {
    mockCallGeminiGenerateContent.mockRejectedValue(
      new Error("Gemini API error: 401 Unauthorized"),
    );

    const callSelectedModel = await loadCallSelectedModel();

    await expect(
      callSelectedModel({ messages: [], tools: [] }),
    ).rejects.toThrow(/Gemini API error/);
    expect(mockCallOpenAIChatCompletion).not.toHaveBeenCalled();
  });
});
