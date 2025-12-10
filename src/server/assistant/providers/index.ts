import {
  callOpenAIChatCompletion,
} from "@/server/assistant/providers/openai";
import {
  callGeminiGenerateContent,
} from "@/server/assistant/providers/gemini";
import { assistantConfig } from "@/server/assistant/config";
import type {
  LLMMessage,
  LLMResponse,
  LLMToolSchema,
} from "@/server/assistant/types";

const GEMINI_TRANSIENT_ERROR_PATTERNS = [
  " 502 ",
  " 503 ",
  " 504 ",
  "unavailable",
  "overloaded",
  "try again later",
  "temporarily unavailable",
];

function shouldFallbackToOpenAI(error: unknown): error is Error {
  if (!process.env.OPENAI_API_KEY) {
    return false;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  if (!message.includes("gemini api error")) {
    return false;
  }
  return GEMINI_TRANSIENT_ERROR_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

export async function callSelectedModel(params: {
  messages: LLMMessage[];
  tools: LLMToolSchema[];
}): Promise<LLMResponse> {
  if (assistantConfig.provider === "gemini") {
    try {
      return await callGeminiGenerateContent(params);
    } catch (error) {
      if (shouldFallbackToOpenAI(error)) {
        console.warn(
          "[assistant] Gemini indisponible, passage sur OpenAI.",
          error,
        );
        return callOpenAIChatCompletion(params);
      }
      throw error;
    }
  }
  return callOpenAIChatCompletion(params);
}
