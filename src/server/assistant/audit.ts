import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditParams = {
  userId: string;
  conversationId?: string | null;
  toolName: string;
  actionLabel: string;
  payload?: unknown;
  result?: unknown;
  status?: "SUCCESS" | "ERROR";
  errorMessage?: string | null;
};

function toJsonInput(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

export async function logAiAudit(params: AuditParams) {
  await prisma.aIAuditLog.create({
    data: {
      userId: params.userId,
      conversationId: params.conversationId ?? null,
      toolName: params.toolName,
      actionLabel: params.actionLabel,
      payload: toJsonInput(params.payload),
      result: toJsonInput(params.result),
      status: params.status ?? "SUCCESS",
      errorMessage: params.errorMessage ?? null,
    },
  });
}
