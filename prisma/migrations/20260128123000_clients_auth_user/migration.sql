ALTER TABLE "Client" ADD COLUMN "authUserId" TEXT;

CREATE UNIQUE INDEX "Client_userId_authUserId_key" ON "Client"("userId", "authUserId");
CREATE INDEX "Client_authUserId_idx" ON "Client"("authUserId");
