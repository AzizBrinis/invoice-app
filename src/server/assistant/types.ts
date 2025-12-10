import type { Prisma } from "@prisma/client";
import type {
  AssistantActionCard,
  AssistantContentBlock,
  AssistantMessage,
  AssistantPendingConfirmation,
  AssistantUsageSummary,
} from "@/types/assistant";
import { type ZodTypeAny, z } from "zod";

export type JsonValue = Prisma.JsonValue;

export type AssistantConversationRecord = {
  id: string;
  title: string;
  status: "ACTIVE" | "ARCHIVED";
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AssistantMessageRecord = AssistantMessage & {
  createdAt: string;
};

export type AssistantContextInput =
  | {
      type: "invoice";
      invoiceId: string;
      intent?: string | null;
    }
  | {
      type: "quote";
      quoteId: string;
      intent?: string | null;
    }
  | {
      type: "client";
      clientId: string;
      intent?: string | null;
    }
  | {
      type: "email";
      mailbox: string;
      uid: number;
      intent?: string | null;
    }
  | {
      type: "product";
      productId: string;
      intent?: string | null;
    }
  | null;

export type ToolExecutionContext = {
  userId: string;
  conversationId: string;
  timezone?: string;
};

export type AssistantToolResult = {
  success: boolean;
  summary: string;
  data?: Prisma.InputJsonValue | null;
  message?: string;
  card?: AssistantActionCard;
  metadata?: Array<{ label: string; value: string }>;
  requiresFollowUp?: boolean;
};

export type ToolHandler<TSchema extends ZodTypeAny> = (
  input: zodInfer<TSchema>,
  context: ToolExecutionContext,
) => Promise<AssistantToolResult>;

export type AssistantToolDefinition<TSchema extends ZodTypeAny = ZodTypeAny> = {
  name: string;
  description: string;
  parameters: TSchema;
  requiresConfirmation?: boolean;
  confirmationSummary?: (input: zodInfer<TSchema>) => string;
  handler: ToolHandler<TSchema>;
};

export type LLMMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  toolCalls?: LLMToolCall[];
};

export type LLMToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LLMProviderName = "openai" | "gemini";

export type LLMResponse = {
  content: string;
  toolCalls?: LLMToolCall[];
  tokens?: number;
};

export type LLMToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AssistantRuntimeContext = {
  userId: string;
  conversationId: string;
  messages: LLMMessage[];
  usage: AssistantUsageSummary;
  pendingConfirmations: AssistantPendingConfirmation[];
};

type zodInfer<T extends ZodTypeAny> = z.infer<T>;
