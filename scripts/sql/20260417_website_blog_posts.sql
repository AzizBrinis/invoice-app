CREATE TABLE IF NOT EXISTS public."WebsiteBlogPost" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES public."User" ("id") ON DELETE CASCADE,
  "websiteId" text NOT NULL REFERENCES public."WebsiteConfig" ("id") ON DELETE CASCADE,
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
  CONSTRAINT "WebsiteBlogPost_websiteId_slug_key"
    UNIQUE ("websiteId", "slug")
);

CREATE INDEX IF NOT EXISTS "WebsiteBlogPost_user_status_publishDate_idx"
  ON public."WebsiteBlogPost" (
    "userId",
    "status",
    "publishDate" DESC,
    "id" DESC
  );

CREATE INDEX IF NOT EXISTS "WebsiteBlogPost_website_publishDate_idx"
  ON public."WebsiteBlogPost" (
    "websiteId",
    "publishDate" DESC,
    "id" DESC
  );

CREATE INDEX IF NOT EXISTS "WebsiteBlogPost_website_featured_publishDate_idx"
  ON public."WebsiteBlogPost" (
    "websiteId",
    "featured",
    "publishDate" DESC,
    "id" DESC
  );

ANALYZE public."WebsiteBlogPost";
