export type AssistantMessageRole = "system" | "user" | "assistant" | "tool";

export type AssistantActionCard = {
  type:
    | "client"
    | "product"
    | "quote"
    | "invoice"
    | "email"
    | "insight"
    | "navigation"
    | "utility";
  title: string;
  subtitle?: string;
  amount?: string;
  href?: string;
  metadata?: Array<{ label: string; value: string }>;
  actions?: Array<{
    label: string;
    href?: string;
    intent?: string;
  }>;
  cta?: { label: string; href: string };
  accentColor?: string;
};

export type AssistantContentBlock =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "action-card";
      card: AssistantActionCard;
    }
  | {
      type: "error";
      text: string;
    };

export type AssistantMessage = {
  id: string;
  role: AssistantMessageRole;
  content: AssistantContentBlock[];
  createdAt: string;
  toolName?: string | null;
  toolCallId?: string | null;
  metadata?: Record<string, unknown> | null;
  pending?: boolean;
};

export type AssistantSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

export type AssistantUsageSummary = {
  used: number;
  limit: number;
  periodLabel: string;
  remaining: number;
  locked?: boolean;
};

export type AssistantContextSummary = {
  type: "invoice" | "quote" | "client" | "email" | "product" | "generic";
  title: string;
  subtitle?: string;
  entityId?: string;
  metadata?: Array<{ label: string; value: string }>;
  quickPrompts?: AssistantSuggestion[];
};

export type AssistantPendingConfirmation = {
  id: string;
  toolName: string;
  summary: string;
  createdAt: string;
  arguments: Record<string, unknown>;
};

export type AssistantStreamEvent =
  | {
      type: "status";
      message: string;
    }
  | {
      type: "message_token";
      delta: string;
      conversationId: string;
    }
  | {
      type: "message_complete";
      message: AssistantMessage;
      conversationId: string;
    }
  | {
      type: "tool_call";
      toolName: string;
      arguments: Record<string, unknown>;
      conversationId: string;
    }
  | {
      type: "tool_result";
      toolName: string;
      result: unknown;
      conversationId: string;
    }
  | {
      type: "confirmation_required";
      confirmation: AssistantPendingConfirmation;
      conversationId: string;
    }
  | {
      type: "action_card";
      card: AssistantActionCard;
      conversationId: string;
    }
  | {
      type: "usage";
      usage: AssistantUsageSummary;
      conversationId: string;
    }
  | {
      type: "error";
      message: string;
      conversationId?: string;
    }
  | {
      type: "suggestions";
      suggestions: AssistantSuggestion[];
      conversationId: string;
    };
