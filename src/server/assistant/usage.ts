import { prisma } from "@/lib/prisma";
import { assistantConfig } from "@/server/assistant/config";
import type { AssistantUsageSummary } from "@/types/assistant";

function getPeriodKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getPeriodLabel(date = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export async function getUsageSummary(
  userId: string,
): Promise<AssistantUsageSummary> {
  const periodKey = getPeriodKey();
  const record = await prisma.aIUsageStat.findUnique({
    where: { userId_periodKey: { userId, periodKey } },
  });
  const used = record?.messageCount ?? 0;
  const limit = assistantConfig.monthlyMessageLimit;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    periodLabel: getPeriodLabel(),
    locked: used >= limit,
  };
}

export async function incrementUsage(params: {
  userId: string;
  messageCount?: number;
  tokens?: number;
  toolInvocations?: number;
}) {
  const periodKey = getPeriodKey();
  await prisma.aIUsageStat.upsert({
    where: { userId_periodKey: { userId: params.userId, periodKey } },
    update: {
      messageCount: {
        increment: params.messageCount ?? 0,
      },
      toolInvocationCount: {
        increment: params.toolInvocations ?? 0,
      },
      tokenCount: {
        increment: params.tokens ?? 0,
      },
    },
    create: {
      userId: params.userId,
      periodKey,
      messageCount: params.messageCount ?? 0,
      toolInvocationCount: params.toolInvocations ?? 0,
      tokenCount: params.tokens ?? 0,
    },
  });
}

export async function enforceUsageLimit(userId: string) {
  const summary = await getUsageSummary(userId);
  if (summary.locked) {
    const error = new Error(
      "Quota mensuel atteint. Réessayez après le renouvellement.",
    );
    error.name = "UsageLimitError";
    throw error;
  }
  return summary;
}
