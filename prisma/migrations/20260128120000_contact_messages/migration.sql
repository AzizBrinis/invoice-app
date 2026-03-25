-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourcePath" TEXT,
    "sourceDomain" TEXT,
    "sourceSlug" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactMessage_userId_createdAt_idx" ON "ContactMessage"("userId", "createdAt");
CREATE INDEX "ContactMessage_websiteId_createdAt_idx" ON "ContactMessage"("websiteId", "createdAt");

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "WebsiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
