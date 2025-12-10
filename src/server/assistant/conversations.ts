import { Prisma, type AIMessageRole as PrismaMessageRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AssistantContentBlock,
  AssistantMessage,
} from "@/types/assistant";
import type {
  AssistantConversationRecord,
  AssistantMessageRecord,
} from "@/server/assistant/types";
import type { AssistantMessageRole } from "@/types/assistant";

const assistantToPrismaRole: Record<
  AssistantMessageRole,
  PrismaMessageRole
> = {
  system: "SYSTEM",
  user: "USER",
  assistant: "ASSISTANT",
  tool: "TOOL",
};

const prismaToAssistantRole: Record<
  PrismaMessageRole,
  AssistantMessageRole
> = {
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
  TOOL: "tool",
};

function toPrismaRole(role: AssistantMessageRole): PrismaMessageRole {
  return assistantToPrismaRole[role];
}

function fromPrismaRole(role: PrismaMessageRole): AssistantMessageRole {
  return prismaToAssistantRole[role];
}

function mapContent(
  value: Prisma.JsonValue | null,
): AssistantContentBlock[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is AssistantContentBlock => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      if (!("type" in entry)) {
        return false;
      }
      const candidate = entry as { type?: unknown };
      return typeof candidate.type === "string";
    },
  );
}

function mapMetadata(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function mapMessage(
  record: Prisma.AIMessageGetPayload<{
    select: {
      id: true;
      role: true;
      content: true;
      attachments: true;
      createdAt: true;
      toolName: true;
      toolCallId: true;
      metadata: true;
    };
  }>,
): AssistantMessage {
  const contentBlocks = mapContent(record.content);
  const attachments = mapContent(record.attachments);
  const combined = [...contentBlocks, ...attachments];

  return {
    id: record.id,
    role: fromPrismaRole(record.role),
    content: combined,
    createdAt: record.createdAt.toISOString(),
    toolName: record.toolName,
    toolCallId: record.toolCallId,
    metadata: mapMetadata(record.metadata),
  };
}

export async function ensureConversation(
  userId: string,
  conversationId?: string | null,
): Promise<AssistantConversationRecord> {
  if (conversationId) {
    const existing = await prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });
    if (existing) {
      return existing;
    }
  }
  const created = await prisma.aIConversation.create({
    data: {
      userId,
      title: "Nouvelle conversation",
    },
  });
  return created;
}

export async function updateConversationTitleIfNeeded(params: {
  conversationId: string;
  userId: string;
  candidate: string;
}) {
  if (!params.candidate.trim()) {
    return;
  }
  await prisma.aIConversation.updateMany({
    where: {
      id: params.conversationId,
      userId: params.userId,
      title: "Nouvelle conversation",
    },
    data: {
      title: params.candidate.slice(0, 80),
    },
  });
}

export async function loadConversationMessages(
  userId: string,
  conversationId: string,
): Promise<AssistantMessageRecord[]> {
  const messages = await prisma.aIMessage.findMany({
    where: { userId, conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      attachments: true,
      createdAt: true,
      toolName: true,
      toolCallId: true,
      metadata: true,
    },
  });
  return messages.map((message) => mapMessage(message));
}

export async function loadConversationMessagesPage(params: {
  userId: string;
  conversationId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{
  messages: AssistantMessageRecord[];
  hasMore: boolean;
  cursor: string | null;
}> {
  const take = Math.max(10, Math.min(params.limit ?? 30, 100));
  const rows = await prisma.aIMessage.findMany({
    where: {
      userId: params.userId,
      conversationId: params.conversationId,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    cursor: params.cursor ? { id: params.cursor } : undefined,
    skip: params.cursor ? 1 : 0,
    take: take + 1,
    select: {
      id: true,
      role: true,
      content: true,
      attachments: true,
      createdAt: true,
      toolName: true,
      toolCallId: true,
      metadata: true,
    },
  });
  const hasMore = rows.length > take;
  const limited = hasMore ? rows.slice(0, take) : rows;
  const ordered = [...limited].reverse();
  const messages = ordered.map((message) => mapMessage(message));
  const cursor =
    hasMore && ordered.length
      ? ordered[0]?.id ?? null
      : null;
  return {
    messages,
    hasMore,
    cursor,
  };
}

export async function persistAssistantMessage(params: {
  userId: string;
  conversationId: string;
  role: AssistantMessageRole;
  content: AssistantContentBlock[];
  attachments?: AssistantContentBlock[];
  toolName?: string;
  toolCallId?: string;
  metadata?: Prisma.InputJsonValue | typeof Prisma.JsonNull | null;
}) {
  if (!params.content.length && !params.attachments?.length) {
    return null;
  }
  const message = await prisma.aIMessage.create({
    data: {
      userId: params.userId,
      conversationId: params.conversationId,
      role: toPrismaRole(params.role),
      content: params.content as unknown as Prisma.InputJsonValue,
      attachments: params.attachments?.length
        ? (params.attachments as unknown as Prisma.InputJsonValue)
        : undefined,
      toolName: params.toolName ?? null,
      toolCallId: params.toolCallId ?? null,
      metadata:
        params.metadata === undefined
          ? undefined
          : params.metadata ?? Prisma.JsonNull,
    },
  });

  await prisma.aIConversation.update({
    where: { id: params.conversationId },
    data: {
      lastActivityAt: new Date(),
    },
  });

  return mapMessage({
    id: message.id,
    role: message.role,
    content: message.content,
    attachments: message.attachments,
    createdAt: message.createdAt,
    toolName: message.toolName,
    toolCallId: message.toolCallId,
    metadata: message.metadata,
  });
}
