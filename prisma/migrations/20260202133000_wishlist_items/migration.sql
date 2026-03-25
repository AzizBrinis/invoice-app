-- Create WishlistItem table
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- Add indexes
CREATE UNIQUE INDEX "WishlistItem_userId_clientId_productId_key" ON "WishlistItem"("userId", "clientId", "productId");
CREATE INDEX "WishlistItem_clientId_idx" ON "WishlistItem"("clientId");
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

-- Add foreign keys
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
