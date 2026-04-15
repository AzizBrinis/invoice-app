-- General site review moderation table for Home/About testimonials.
-- Apply with DIRECT_URL/session pooler. The table creation is idempotent and data-preserving.

CREATE TABLE IF NOT EXISTS public."SiteReview" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES public."User" ("id") ON DELETE CASCADE,
  "websiteId" text NOT NULL REFERENCES public."WebsiteConfig" ("id") ON DELETE CASCADE,
  "clientId" text REFERENCES public."Client" ("id") ON DELETE SET NULL,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "title" varchar(140),
  "body" text NOT NULL CHECK (char_length("body") BETWEEN 10 AND 2000),
  "authorName" varchar(120) NOT NULL,
  "authorEmail" varchar(160),
  "authorRole" varchar(140),
  "avatarUrl" varchar(500),
  "status" text NOT NULL DEFAULT 'PENDING'
    CHECK ("status" IN ('PENDING', 'APPROVED', 'DECLINED')),
  "moderationReason" text,
  "moderatedAt" timestamp(3),
  "moderatedByUserId" text REFERENCES public."User" ("id") ON DELETE SET NULL,
  "sourcePath" varchar(200),
  "sourceDomain" varchar(120),
  "sourceSlug" varchar(64),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SiteReview_user_status_created_idx"
  ON public."SiteReview" ("userId", "status", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "SiteReview_website_status_created_idx"
  ON public."SiteReview" ("websiteId", "status", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "SiteReview_user_authorEmail_created_idx"
  ON public."SiteReview" ("userId", "authorEmail", "createdAt" DESC)
  WHERE "authorEmail" IS NOT NULL;

ANALYZE public."SiteReview";
