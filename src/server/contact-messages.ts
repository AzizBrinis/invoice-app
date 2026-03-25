import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { resolveCatalogWebsite } from "@/server/website";

const contactMessageSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  message: z.string().min(2).max(2000),
  path: z.string().max(200).nullable().optional(),
  honeypot: z.string().optional(),
  mode: z.enum(["public", "preview"]).default("public"),
});

export type ContactMessageInput = z.input<typeof contactMessageSchema> & {
  slug?: string | null;
  domain?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

const contactMessageListSelect =
  Prisma.validator<Prisma.ContactMessageSelect>()({
    id: true,
    name: true,
    email: true,
    message: true,
    sourcePath: true,
    createdAt: true,
  });

export type ContactMessageListItem = Prisma.ContactMessageGetPayload<{
  select: typeof contactMessageListSelect;
}>;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 60;

export async function recordContactMessage(input: ContactMessageInput) {
  const parsed = contactMessageSchema.parse(input);
  if (parsed.honeypot && parsed.honeypot.trim().length > 0) {
    throw new Error("Requete bloquee.");
  }
  if (parsed.mode === "preview") {
    return { status: "preview-only" } as const;
  }

  const website = await resolveCatalogWebsite({
    slug: input.slug ?? null,
    domain: input.domain ?? null,
    preview: false,
  });
  if (!website) {
    throw new Error("Site indisponible.");
  }

  const record = await prisma.contactMessage.create({
    data: {
      userId: website.userId,
      websiteId: website.id,
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      message: parsed.message,
      sourcePath: parsed.path ?? null,
      sourceDomain: input.domain ?? website.customDomain,
      sourceSlug: website.slug,
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  return { status: "created" as const, id: record.id };
}

export async function listContactMessages(filters?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: ContactMessageListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const { id: userId } = await requireUser();
  const page = Math.max(filters?.page ?? 1, 1);
  const pageSize = Math.min(
    Math.max(filters?.pageSize ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const search = filters?.search?.trim();

  const where = {
    userId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { message: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      select: contactMessageListSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  const pageCount = Math.max(Math.ceil(total / pageSize), 1);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount,
  };
}

export async function getContactMessage(id: string) {
  const { id: userId } = await requireUser();
  return prisma.contactMessage.findFirst({
    where: { id, userId },
  });
}
