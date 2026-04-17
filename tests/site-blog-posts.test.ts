import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const { mockRequireUser } = vi.hoisted(() => ({
  mockRequireUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

import {
  createSiteBlogPost,
  deleteSiteBlogPost,
  getPublicSiteBlogPostBySlug,
  getSiteBlogPost,
  listPublicSiteBlogPostSummaries,
  listSiteBlogPosts,
  updateSiteBlogPost,
} from "@/server/site-blog-posts";

async function ensureWebsiteBlogPostTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public."WebsiteBlogPost" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE,
      "websiteId" text NOT NULL REFERENCES public."WebsiteConfig"("id") ON DELETE CASCADE,
      "title" text NOT NULL,
      "slug" text NOT NULL,
      "excerpt" text,
      "bodyHtml" text NOT NULL,
      "coverImageUrl" text,
      "socialImageUrl" text,
      "category" text,
      "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "authorName" text NOT NULL,
      "status" text NOT NULL DEFAULT 'DRAFT',
      "publishDate" date,
      "featured" boolean NOT NULL DEFAULT false,
      "metaTitle" text,
      "metaDescription" text,
      "wordCount" integer NOT NULL DEFAULT 0,
      "readingTimeMinutes" integer NOT NULL DEFAULT 1,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT "WebsiteBlogPost_status_check"
        CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'SCHEDULED')),
      CONSTRAINT "WebsiteBlogPost_wordCount_check"
        CHECK ("wordCount" >= 0),
      CONSTRAINT "WebsiteBlogPost_readingTimeMinutes_check"
        CHECK ("readingTimeMinutes" >= 1),
      CONSTRAINT "WebsiteBlogPost_website_slug_key"
        UNIQUE ("websiteId", "slug")
    )
  `);
}

function dateOffset(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

let primaryUserId = "";
let primaryWebsiteId = "";
let secondaryUserId = "";
let secondaryWebsiteId = "";

describeWithDb("site blog posts", () => {
  beforeAll(async () => {
    await ensureWebsiteBlogPostTable();

    const timestamp = Date.now();
    const primaryUser = await prisma.user.create({
      data: {
        email: `site-blog-primary-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Primary Blog User",
      },
    });
    primaryUserId = primaryUser.id;

    const secondaryUser = await prisma.user.create({
      data: {
        email: `site-blog-secondary-${timestamp}@example.com`,
        passwordHash: "hashed",
        name: "Secondary Blog User",
      },
    });
    secondaryUserId = secondaryUser.id;

    const primaryWebsite = await prisma.websiteConfig.create({
      data: {
        userId: primaryUser.id,
        slug: `site-blog-primary-${timestamp}`,
        templateKey: "ecommerce-ciseco-home",
      },
    });
    primaryWebsiteId = primaryWebsite.id;

    const secondaryWebsite = await prisma.websiteConfig.create({
      data: {
        userId: secondaryUser.id,
        slug: `site-blog-secondary-${timestamp}`,
        templateKey: "ecommerce-ciseco-home",
      },
    });
    secondaryWebsiteId = secondaryWebsite.id;
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public."WebsiteBlogPost" WHERE "userId" IN ($1, $2)`,
      primaryUserId,
      secondaryUserId,
    );

    mockRequireUser.mockReset();
    mockRequireUser.mockResolvedValue({
      id: primaryUserId,
      tenantId: null,
      activeTenantId: null,
      name: "Primary Blog User",
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public."WebsiteBlogPost" WHERE "userId" IN ($1, $2)`,
      primaryUserId,
      secondaryUserId,
    );
    await prisma.websiteConfig.deleteMany({
      where: {
        id: {
          in: [primaryWebsiteId, secondaryWebsiteId],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [primaryUserId, secondaryUserId],
        },
      },
    });
  });

  it("runs tenant-scoped CRUD and public visibility transitions end-to-end", async () => {
    const created = await createSiteBlogPost({
      title: "Launch checklist for the store blog",
      excerpt: "Draft excerpt",
      bodyHtml:
        "<p>Draft body.</p><h2>Intro</h2><p>Body with <script>alert(1)</script>sanitized HTML.</p>",
      authorName: "Primary Editor",
      category: "Launches",
      tags: ["launch", "seo"],
      status: "DRAFT",
      featured: false,
      metaTitle: "Draft SEO title",
      metaDescription: "Draft SEO description",
    });

    expect(created?.slug).toBe("launch-checklist-for-the-store-blog");
    expect(created?.bodyHtml).not.toContain("<script>");

    const adminListAfterCreate = await listSiteBlogPosts({}, primaryUserId);
    expect(adminListAfterCreate.total).toBe(1);
    expect(adminListAfterCreate.items[0]?.status).toBe("DRAFT");

    expect(
      await listPublicSiteBlogPostSummaries({ websiteId: primaryWebsiteId }),
    ).toHaveLength(0);

    const scheduledDate = dateOffset(2);
    const scheduled = await updateSiteBlogPost(created!.id, {
      title: "Launch checklist for the store blog",
      slug: "launch-checklist-store-blog",
      excerpt: "Scheduled excerpt",
      bodyHtml: "<p>Scheduled body.</p><h2>Plan</h2><p>Body.</p>",
      authorName: "Primary Editor",
      category: "Launches",
      tags: ["launch", "editorial"],
      status: "SCHEDULED",
      publishDate: scheduledDate,
      featured: true,
      metaTitle: "Scheduled SEO title",
      metaDescription: "Scheduled SEO description",
    });

    expect(scheduled?.slug).toBe("launch-checklist-store-blog");
    expect(
      await listPublicSiteBlogPostSummaries({ websiteId: primaryWebsiteId }),
    ).toHaveLength(0);
    expect(
      await listPublicSiteBlogPostSummaries({
        websiteId: primaryWebsiteId,
        preview: true,
      }),
    ).toHaveLength(1);

    const publishedDate = dateOffset(0);
    const published = await updateSiteBlogPost(created!.id, {
      title: "Launch checklist for the store blog",
      slug: "launch-checklist-store-blog",
      excerpt: "Published excerpt",
      bodyHtml:
        "<p>Published body.</p><h2>Plan</h2><p>Body.</p><h3>Checklist</h3><p>Ready.</p>",
      authorName: "Primary Editor",
      category: "Launches",
      tags: ["launch", "editorial"],
      status: "PUBLISHED",
      publishDate: publishedDate,
      featured: true,
      metaTitle: "Published SEO title",
      metaDescription: "Published SEO description",
    });

    expect(published?.isLive).toBe(true);
    expect(published?.headings).toEqual([
      { id: "plan", text: "Plan", level: 2 },
      { id: "checklist", text: "Checklist", level: 3 },
    ]);

    const publicSummaries = await listPublicSiteBlogPostSummaries({
      websiteId: primaryWebsiteId,
    });
    expect(publicSummaries).toHaveLength(1);
    expect(publicSummaries[0]).toMatchObject({
      slug: "launch-checklist-store-blog",
      metaTitle: "Published SEO title",
      metaDescription: "Published SEO description",
      featured: true,
    });

    const publicDetail = await getPublicSiteBlogPostBySlug({
      websiteId: primaryWebsiteId,
      slug: "launch-checklist-store-blog",
    });
    expect(publicDetail?.bodyHtml).toContain("<h2 id=\"plan\">");
    expect(publicDetail?.headings).toHaveLength(2);

    await deleteSiteBlogPost(created!.id);
    expect(await getSiteBlogPost(created!.id, primaryUserId)).toBeNull();
    expect(
      await listPublicSiteBlogPostSummaries({ websiteId: primaryWebsiteId }),
    ).toHaveLength(0);
  });

  it("enforces tenant scoping for admin reads", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: secondaryUserId,
      tenantId: null,
      activeTenantId: null,
      name: "Secondary Blog User",
    });

    const secondaryPost = await createSiteBlogPost({
      title: "Secondary tenant article",
      bodyHtml: "<p>Secondary tenant body.</p>",
      authorName: "Secondary Editor",
      status: "PUBLISHED",
      publishDate: dateOffset(0),
      featured: false,
      tags: ["secondary"],
    });

    const primaryList = await listSiteBlogPosts({}, primaryUserId);
    expect(primaryList.total).toBe(0);
    expect(await getSiteBlogPost(secondaryPost!.id, primaryUserId)).toBeNull();

    const secondaryList = await listSiteBlogPosts({}, secondaryUserId);
    expect(secondaryList.total).toBe(1);
    expect(
      await listPublicSiteBlogPostSummaries({ websiteId: primaryWebsiteId }),
    ).toHaveLength(0);
    expect(
      await listPublicSiteBlogPostSummaries({ websiteId: secondaryWebsiteId }),
    ).toHaveLength(1);
  });
});
