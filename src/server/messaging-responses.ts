import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SavedResponseFormat as PrismaSavedResponseFormat } from "@prisma/client";
import type { SavedResponse, SavedResponseFormat } from "@/lib/messaging/saved-responses";
import {
  DEFAULT_SAVED_RESPONSES,
  type DefaultSavedResponse,
} from "@/lib/messaging/default-responses";

type SavedResponseInput = {
  title: string;
  description?: string | null;
  content: string;
  format: SavedResponseFormat;
};

type UpdatableSavedResponseInput = SavedResponseInput & {
  id: string;
};

function normalizeDefaultEntry(entry: DefaultSavedResponse): {
  slug: string;
  title: string;
  description: string;
  content: string;
  format: SavedResponseFormat;
} {
  return {
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    content: entry.content,
    format: entry.format,
  };
}

async function resolveUserId(userId?: string) {
  if (userId) {
    return userId;
  }
  const user = await requireUser();
  return user.id;
}

function serializeSavedResponse(entity: {
  id: string;
  title: string;
  description: string | null;
  content: string;
  format: PrismaSavedResponseFormat;
  builtIn: boolean;
  slug: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SavedResponse {
  return {
    id: entity.id,
    title: entity.title,
    description: entity.description,
    content: entity.content,
    format:
      entity.format === PrismaSavedResponseFormat.HTML ? "HTML" : "PLAINTEXT",
    builtIn: entity.builtIn,
    slug: entity.slug,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

async function ensureDefaultSavedResponses(userId: string) {
  await Promise.all(
    DEFAULT_SAVED_RESPONSES.map((rawEntry) => {
      const entry = normalizeDefaultEntry(rawEntry);
      return prisma.messagingSavedResponse.upsert({
        where: {
          userId_slug: {
            userId,
            slug: entry.slug,
          },
        },
        update: {
          title: entry.title,
          description: entry.description,
          content: entry.content,
          format:
            entry.format === "HTML"
              ? PrismaSavedResponseFormat.HTML
              : PrismaSavedResponseFormat.PLAINTEXT,
          builtIn: true,
        },
        create: {
          userId,
          title: entry.title,
          description: entry.description,
          content: entry.content,
          format:
            entry.format === "HTML"
              ? PrismaSavedResponseFormat.HTML
              : PrismaSavedResponseFormat.PLAINTEXT,
          slug: entry.slug,
          builtIn: true,
        },
      });
    }),
  );
}

export async function listSavedResponses(userId?: string): Promise<SavedResponse[]> {
  const resolvedUserId = await resolveUserId(userId);
  await ensureDefaultSavedResponses(resolvedUserId);

  const responses = await prisma.messagingSavedResponse.findMany({
    where: { userId: resolvedUserId },
    orderBy: [
      { builtIn: "desc" },
      { updatedAt: "desc" },
    ],
  });

  return responses.map(serializeSavedResponse);
}

export async function createSavedResponse(
  input: SavedResponseInput,
): Promise<SavedResponse> {
  const user = await requireUser();

  const created = await prisma.messagingSavedResponse.create({
    data: {
      userId: user.id,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      content: input.content,
      format:
        input.format === "HTML"
          ? PrismaSavedResponseFormat.HTML
          : PrismaSavedResponseFormat.PLAINTEXT,
      builtIn: false,
    },
  });

  return serializeSavedResponse(created);
}

export async function updateSavedResponse(
  input: UpdatableSavedResponseInput,
): Promise<SavedResponse> {
  const user = await requireUser();

  const existing = await prisma.messagingSavedResponse.findFirst({
    where: {
      id: input.id,
      userId: user.id,
    },
  });

  if (!existing) {
    throw new Error("Réponse introuvable.");
  }

  const updated = await prisma.messagingSavedResponse.update({
    where: { id: input.id },
    data: {
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      content: input.content,
      format:
        input.format === "HTML"
          ? PrismaSavedResponseFormat.HTML
          : PrismaSavedResponseFormat.PLAINTEXT,
    },
  });

  return serializeSavedResponse(updated);
}

export async function deleteSavedResponse(id: string): Promise<{ id: string }> {
  const user = await requireUser();

  const existing = await prisma.messagingSavedResponse.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!existing) {
    throw new Error("Réponse introuvable.");
  }

  if (existing.builtIn) {
    throw new Error("Les modèles par défaut ne peuvent pas être supprimés.");
  }

  await prisma.messagingSavedResponse.delete({
    where: { id },
  });

  return { id };
}
