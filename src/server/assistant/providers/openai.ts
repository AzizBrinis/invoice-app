import type {
  LLMMessage,
  LLMResponse,
  LLMToolCall,
  LLMToolSchema,
} from "@/server/assistant/types";
import { assistantConfig, assertAiCredentials } from "@/server/assistant/config";

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type OpenAIChatCompletion = {
  choices: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    total_tokens?: number;
  };
};

function normalizeMessages(messages: LLMMessage[]): OpenAIMessage[] {
  return messages.map((message) => {
    const normalized: OpenAIMessage = {
      role: message.role,
      content: message.content,
    };

    if (message.tool_call_id) {
      normalized.tool_call_id = message.tool_call_id;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      normalized.tool_calls = message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments ?? {}),
        },
      }));
    }

    return normalized;
  });
}

function normalizeTools(tools: LLMToolSchema[]) {
  if (!tools.length) {
    return undefined;
  }
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function parseToolCalls(
  raw: OpenAIChatCompletion["choices"][number]["message"],
): LLMToolCall[] {
  if (!raw?.tool_calls?.length) {
    return [];
  }
  return raw.tool_calls
    .map((call) => {
      try {
        const parsed = JSON.parse(call.function.arguments) as Record<
          string,
          unknown
        >;
        return {
          id: call.id,
          name: call.function.name,
          arguments: parsed,
        };
      } catch (error) {
        console.warn(
          "[assistant][openai] Unable to parse tool arguments",
          error,
        );
        return null;
      }
    })
    .filter((entry): entry is LLMToolCall => Boolean(entry));
}

export async function callOpenAIChatCompletion(params: {
  messages: LLMMessage[];
  tools: LLMToolSchema[];
}): Promise<LLMResponse> {
  assertAiCredentials("openai");
  const apiKey = process.env.OPENAI_API_KEY!;
  const tools = normalizeTools(params.tools);
  const body = {
    model: assistantConfig.openAIModel,
    temperature: 0.2,
    messages: normalizeMessages(params.messages),
    tools,
    ...(tools ? { tool_choice: "auto" as const } : {}),
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} ${detail}`,
    );
  }

  const json = (await response.json()) as OpenAIChatCompletion;
  const choice = json.choices?.[0];
  const message = choice?.message;
  const content =
    typeof message?.content === "string" ? message.content : "";
  const toolCalls = parseToolCalls(message);

  return {
    content,
    toolCalls,
    tokens: json.usage?.total_tokens ?? undefined,
  };
}
