import { Prisma } from "@prisma/client";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { AssistantPendingConfirmation } from "@/types/assistant";

const PENDING_EXPIRATION_MINUTES = 30;

export async function createPendingToolCall(params: {
  userId: string;
  conversationId: string;
  toolName: string;
  summary: string;
  arguments: Prisma.InputJsonValue;
}) {
  const expiresAt = addMinutes(new Date(), PENDING_EXPIRATION_MINUTES);
  const pending = await prisma.aIPendingToolCall.create({
    data: {
      userId: params.userId,
      conversationId: params.conversationId,
      toolName: params.toolName,
      summary: params.summary,
      arguments: params.arguments,
      expiresAt,
    },
  });
  return pending;
}

export async function consumePendingToolCall(params: {
  userId: string;
  pendingId: string;
}) {
  const pending = await prisma.aIPendingToolCall.findFirst({
    where: {
      id: params.pendingId,
      userId: params.userId,
      expiresAt: {
        gt: new Date(),
      },
    },
  });
  if (!pending) {
    return null;
  }
  await prisma.aIPendingToolCall.delete({ where: { id: pending.id } });
  return pending;
}

export async function getActivePendingToolCall(params: {
  userId: string;
  conversationId: string;
}): Promise<AssistantPendingConfirmation | null> {
  const pending = await prisma.aIPendingToolCall.findFirst({
    where: {
      userId: params.userId,
      conversationId: params.conversationId,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) {
    return null;
  }
  return {
    id: pending.id,
    toolName: pending.toolName,
    summary: pending.summary,
    createdAt: pending.createdAt.toISOString(),
    arguments: pending.arguments as Record<string, unknown>,
  };
}
