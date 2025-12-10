import type {
  LLMMessage,
  LLMResponse,
  LLMToolCall,
  LLMToolSchema,
} from "@/server/assistant/types";
import { assistantConfig, assertAiCredentials } from "@/server/assistant/config";

type GeminiPart = {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response?: Record<string, unknown>;
  };
};

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiResponseBody = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  usageMetadata?: {
    totalTokenCount?: number;
  };
};

function convertMessagesToContents(messages: LLMMessage[]): {
  contents: GeminiContent[];
  systemInstruction?: { role: "system"; parts: { text: string }[] };
} {
  const contents: GeminiContent[] = [];
  const systemParts: { text: string }[] = [];

  messages.forEach((message) => {
    if (message.role === "system") {
      systemParts.push({ text: message.content });
      return;
    }

    if (message.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: message.name ?? "tool_result",
              response: (() => {
                try {
                  return JSON.parse(message.content) as Record<
                    string,
                    unknown
                  >;
                } catch {
                  return { output: message.content };
                }
              })(),
            },
          },
        ],
      });
      return;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      contents.push({
        role: "model",
        parts: [
          ...(message.content
            ? ([{ text: message.content }] as GeminiPart[])
            : []),
          ...message.toolCalls.map((call) => ({
            functionCall: {
              name: call.name,
              args: call.arguments,
            },
          })),
        ],
      });
      return;
    }

    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    });
  });

  return {
    contents,
    systemInstruction: systemParts.length
      ? {
          role: "system",
          parts: systemParts,
        }
      : undefined,
  };
}

function convertTools(tools: LLMToolSchema[]) {
  if (!tools.length) {
    return undefined;
  }
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

function parseGeminiToolCalls(parts: GeminiPart[]): LLMToolCall[] {
  return parts
    .map((part) => {
      if (!part.functionCall) {
        return null;
      }
      return {
        id: `${part.functionCall.name}-${Math.random().toString(36).slice(2, 8)}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args ?? {},
      };
    })
    .filter((entry): entry is LLMToolCall => Boolean(entry));
}

export async function callGeminiGenerateContent(params: {
  messages: LLMMessage[];
  tools: LLMToolSchema[];
}): Promise<LLMResponse> {
  assertAiCredentials("gemini");
  const apiKey = process.env.GEMINI_API_KEY!;
  const { contents, systemInstruction } = convertMessagesToContents(
    params.messages,
  );
  const body = {
    contents,
    systemInstruction,
    tools: convertTools(params.tools),
    toolConfig: params.tools.length
      ? {
          functionCallingConfig: {
            mode: "AUTO",
          },
        }
      : undefined,
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${assistantConfig.geminiModel}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText} ${detail}`,
    );
  }

  const json = (await response.json()) as GeminiResponseBody;
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const content = parts
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n");
  const toolCalls = parseGeminiToolCalls(parts);

  return {
    content,
    toolCalls,
    tokens: json.usageMetadata?.totalTokenCount ?? undefined,
  };
}
