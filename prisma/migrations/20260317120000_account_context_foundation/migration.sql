CREATE TYPE "AccountType" AS ENUM ('FULL_APP', 'CLIENT_PAYMENTS');
CREATE TYPE "AccountMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "AccountPermission" AS ENUM (
    'DASHBOARD_VIEW',
    'CLIENTS_VIEW',
    'CLIENTS_MANAGE',
    'SERVICES_MANAGE',
    'PAYMENTS_MANAGE',
    'RECEIPTS_MANAGE',
    'REPORTS_VIEW',
    'COLLABORATORS_MANAGE'
);
CREATE TYPE "AccountInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

ALTER TABLE "Session" ADD COLUMN "activeTenantId" TEXT;

CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'FULL_APP',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountMembership" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AccountMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountMembershipPermission" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "permission" "AccountPermission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountMembershipPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountInvitation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "role" "AccountMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" "AccountInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountInvitationPermission" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "permission" "AccountPermission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountInvitationPermission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Session_activeTenantId_idx" ON "Session"("activeTenantId");
CREATE UNIQUE INDEX "AccountMembership_accountId_userId_key" ON "AccountMembership"("accountId", "userId");
CREATE INDEX "AccountMembership_userId_accountId_idx" ON "AccountMembership"("userId", "accountId");
CREATE UNIQUE INDEX "AccountMembershipPermission_membershipId_permission_key" ON "AccountMembershipPermission"("membershipId", "permission");
CREATE UNIQUE INDEX "AccountInvitation_tokenHash_key" ON "AccountInvitation"("tokenHash");
CREATE INDEX "AccountInvitation_accountId_email_status_idx" ON "AccountInvitation"("accountId", "email", "status");
CREATE INDEX "AccountInvitation_email_status_idx" ON "AccountInvitation"("email", "status");
CREATE UNIQUE INDEX "AccountInvitationPermission_invitationId_permission_key" ON "AccountInvitationPermission"("invitationId", "permission");

ALTER TABLE "Account" ADD CONSTRAINT "Account_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountMembership" ADD CONSTRAINT "AccountMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountMembership" ADD CONSTRAINT "AccountMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountMembershipPermission" ADD CONSTRAINT "AccountMembershipPermission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "AccountMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountInvitation" ADD CONSTRAINT "AccountInvitation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountInvitation" ADD CONSTRAINT "AccountInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountInvitation" ADD CONSTRAINT "AccountInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountInvitationPermission" ADD CONSTRAINT "AccountInvitationPermission_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "AccountInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Account" ("id", "type", "displayName", "createdAt", "updatedAt")
SELECT
    "id",
    'FULL_APP'::"AccountType",
    COALESCE(NULLIF("name", ''), "email"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AccountMembership" ("id", "accountId", "userId", "role", "createdAt", "updatedAt")
SELECT
    CONCAT('acctm_', md5("id" || ':owner')),
    "id",
    "id",
    'OWNER'::"AccountMembershipRole",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("accountId", "userId") DO UPDATE
SET
    "role" = EXCLUDED."role",
    "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Session"
SET "activeTenantId" = "userId"
WHERE "activeTenantId" IS NULL;

ALTER TABLE "Session" ADD CONSTRAINT "Session_activeTenantId_fkey" FOREIGN KEY ("activeTenantId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
