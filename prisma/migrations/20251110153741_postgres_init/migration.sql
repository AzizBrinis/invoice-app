-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNTANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "SavedResponseFormat" AS ENUM ('PLAINTEXT', 'HTML');

-- CreateEnum
CREATE TYPE "MessagingRecipientType" AS ENUM ('TO', 'CC', 'BCC');

-- CreateEnum
CREATE TYPE "MessagingEventType" AS ENUM ('OPEN', 'CLICK');

-- CreateEnum
CREATE TYPE "MessagingScheduledStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessagingAutoReplyType" AS ENUM ('STANDARD', 'VACATION');

-- CreateEnum
CREATE TYPE "WebsiteDomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "WebsiteThemeMode" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "PdfTemplateType" AS ENUM ('DEVIS', 'FACTURE');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('MANUAL', 'IMPORT', 'WEBSITE_LEAD');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('BROUILLON', 'ENVOYE', 'ACCEPTE', 'REFUSE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('BROUILLON', 'ENVOYEE', 'PAYEE', 'PARTIELLE', 'RETARD', 'ANNULEE');

-- CreateEnum
CREATE TYPE "InvoiceAuditAction" AS ENUM ('CANCELLATION', 'DELETION');

-- CreateEnum
CREATE TYPE "SequenceType" AS ENUM ('DEVIS', 'FACTURE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DEVIS', 'FACTURE');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ECHEC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoData" TEXT,
    "matriculeFiscal" TEXT,
    "tvaNumber" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "iban" TEXT,
    "stampImage" TEXT,
    "signatureImage" TEXT,
    "stampPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "signaturePosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'TND',
    "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "invoiceNumberPrefix" TEXT NOT NULL DEFAULT 'FAC',
    "quoteNumberPrefix" TEXT NOT NULL DEFAULT 'DEV',
    "resetNumberingAnnually" BOOLEAN NOT NULL DEFAULT true,
    "defaultInvoiceFooter" TEXT,
    "defaultQuoteFooter" TEXT,
    "legalFooter" TEXT,
    "defaultConditions" TEXT,
    "invoiceTemplateId" TEXT,
    "quoteTemplateId" TEXT,
    "taxConfiguration" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL DEFAULT 'dev-agency',
    "previewToken" TEXT NOT NULL,
    "heroEyebrow" TEXT,
    "heroTitle" TEXT NOT NULL DEFAULT 'Découvrez nos solutions',
    "heroSubtitle" TEXT,
    "heroPrimaryCtaLabel" TEXT DEFAULT 'Demander un devis',
    "heroSecondaryCtaLabel" TEXT DEFAULT 'Télécharger la plaquette',
    "heroSecondaryCtaUrl" TEXT,
    "aboutTitle" TEXT,
    "aboutBody" TEXT,
    "contactBlurb" TEXT,
    "contactEmailOverride" TEXT,
    "contactPhoneOverride" TEXT,
    "contactAddressOverride" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "socialImageUrl" TEXT,
    "socialLinks" JSONB,
    "theme" "WebsiteThemeMode" NOT NULL DEFAULT 'SYSTEM',
    "accentColor" TEXT NOT NULL DEFAULT '#2563eb',
    "showPrices" BOOLEAN NOT NULL DEFAULT true,
    "showInactiveProducts" BOOLEAN NOT NULL DEFAULT false,
    "featuredProductIds" JSONB,
    "leadNotificationEmail" TEXT,
    "leadAutoTag" TEXT,
    "leadThanksMessage" TEXT,
    "spamProtectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customDomain" TEXT,
    "domainStatus" "WebsiteDomainStatus" NOT NULL DEFAULT 'PENDING',
    "domainVerificationCode" TEXT NOT NULL,
    "domainVerifiedAt" TIMESTAMP(3),
    "domainActivatedAt" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "previewPath" TEXT NOT NULL DEFAULT 'catalogue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromEmail" TEXT,
    "senderName" TEXT,
    "senderLogoUrl" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "imapUser" TEXT,
    "imapPassword" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "spamFilterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReplySubject" TEXT,
    "autoReplyBody" TEXT,
    "vacationModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vacationSubject" TEXT,
    "vacationMessage" TEXT,
    "vacationStartDate" TIMESTAMP(3),
    "vacationEndDate" TIMESTAMP(3),
    "vacationBackupEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingSavedResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "format" "SavedResponseFormat" NOT NULL DEFAULT 'PLAINTEXT',
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingSavedResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingAutoReplyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "replyType" "MessagingAutoReplyType" NOT NULL,
    "originalMessageId" TEXT,
    "originalUid" INTEGER,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingAutoReplyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingScheduledEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "to" JSONB NOT NULL,
    "cc" JSONB,
    "bcc" JSONB,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "previewText" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "status" "MessagingScheduledStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingScheduledEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingScheduledAttachment" (
    "id" TEXT NOT NULL,
    "scheduledEmailId" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" TEXT,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingScheduledAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "senderSessionHash" TEXT,
    "senderIpHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingEmailRecipient" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT,
    "type" "MessagingRecipientType" NOT NULL,
    "openToken" TEXT NOT NULL,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingEmailRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingEmailLink" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingEmailLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingEmailLinkRecipient" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "firstClickedAt" TIMESTAMP(3),
    "lastClickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingEmailLinkRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingEmailEvent" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "recipientId" TEXT,
    "linkId" TEXT,
    "linkRecipientId" TEXT,
    "type" "MessagingEventType" NOT NULL,
    "userAgent" TEXT,
    "deviceFamily" TEXT,
    "deviceType" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingEmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpamDetectionLog" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT,
    "mailbox" TEXT NOT NULL,
    "targetMailbox" TEXT,
    "uid" INTEGER NOT NULL,
    "subject" TEXT,
    "sender" TEXT,
    "score" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "reasons" JSONB,
    "autoMoved" BOOLEAN NOT NULL DEFAULT false,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "actor" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SpamDetectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpamSenderReputation" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "spamCount" INTEGER NOT NULL DEFAULT 0,
    "hamCount" INTEGER NOT NULL DEFAULT 0,
    "lastFeedbackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpamSenderReputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfTemplate" (
    "id" TEXT NOT NULL,
    "type" "PdfTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vatNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "ClientSource" NOT NULL DEFAULT 'MANUAL',
    "leadMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "priceHTCents" INTEGER NOT NULL,
    "priceTTCCents" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "defaultDiscountRate" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isListedInCatalog" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'BROUILLON',
    "reference" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "clientId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "globalDiscountRate" DOUBLE PRECISION,
    "globalDiscountAmountCents" INTEGER,
    "vatBreakdown" JSONB,
    "taxSummary" JSONB,
    "taxConfiguration" JSONB,
    "notes" TEXT,
    "terms" TEXT,
    "subtotalHTCents" INTEGER NOT NULL,
    "totalDiscountCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "fodecAmountCents" INTEGER NOT NULL DEFAULT 0,
    "timbreAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "unitPriceHTCents" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "discountRate" DOUBLE PRECISION,
    "discountAmountCents" INTEGER,
    "totalHTCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "fodecRate" DOUBLE PRECISION,
    "fodecAmountCents" INTEGER,
    "position" INTEGER NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'BROUILLON',
    "reference" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "clientId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "globalDiscountRate" DOUBLE PRECISION,
    "globalDiscountAmountCents" INTEGER,
    "vatBreakdown" JSONB,
    "taxSummary" JSONB,
    "taxConfiguration" JSONB,
    "notes" TEXT,
    "terms" TEXT,
    "lateFeeRate" DOUBLE PRECISION,
    "subtotalHTCents" INTEGER NOT NULL,
    "totalDiscountCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "fodecAmountCents" INTEGER NOT NULL DEFAULT 0,
    "timbreAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "quoteId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "unitPriceHTCents" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "discountRate" DOUBLE PRECISION,
    "discountAmountCents" INTEGER,
    "totalHTCents" INTEGER NOT NULL,
    "totalTVACents" INTEGER NOT NULL,
    "totalTTCCents" INTEGER NOT NULL,
    "fodecRate" DOUBLE PRECISION,
    "fodecAmountCents" INTEGER,
    "position" INTEGER NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceAuditLog" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "InvoiceAuditAction" NOT NULL,
    "previousStatus" "InvoiceStatus",
    "newStatus" "InvoiceStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberingSequence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SequenceType" NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberingSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "sentAt" TIMESTAMP(3),
    "status" "EmailStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_userId_key" ON "CompanySettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_userId_key" ON "WebsiteConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_slug_key" ON "WebsiteConfig"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_previewToken_key" ON "WebsiteConfig"("previewToken");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_customDomain_key" ON "WebsiteConfig"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_domainVerificationCode_key" ON "WebsiteConfig"("domainVerificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingSettings_userId_key" ON "MessagingSettings"("userId");

-- CreateIndex
CREATE INDEX "MessagingSavedResponse_userId_title_idx" ON "MessagingSavedResponse"("userId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingSavedResponse_userId_slug_key" ON "MessagingSavedResponse"("userId", "slug");

-- CreateIndex
CREATE INDEX "MessagingAutoReplyLog_userId_senderEmail_idx" ON "MessagingAutoReplyLog"("userId", "senderEmail");

-- CreateIndex
CREATE INDEX "MessagingAutoReplyLog_userId_sentAt_idx" ON "MessagingAutoReplyLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "MessagingScheduledEmail_userId_status_sendAt_idx" ON "MessagingScheduledEmail"("userId", "status", "sendAt");

-- CreateIndex
CREATE INDEX "MessagingScheduledEmail_status_sendAt_idx" ON "MessagingScheduledEmail"("status", "sendAt");

-- CreateIndex
CREATE INDEX "MessagingScheduledAttachment_scheduledEmailId_idx" ON "MessagingScheduledAttachment"("scheduledEmailId");

-- CreateIndex
CREATE INDEX "MessagingEmail_userId_sentAt_idx" ON "MessagingEmail"("userId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingEmail_userId_messageId_key" ON "MessagingEmail"("userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingEmailRecipient_openToken_key" ON "MessagingEmailRecipient"("openToken");

-- CreateIndex
CREATE INDEX "MessagingEmailRecipient_emailId_address_idx" ON "MessagingEmailRecipient"("emailId", "address");

-- CreateIndex
CREATE INDEX "MessagingEmailLink_emailId_idx" ON "MessagingEmailLink"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingEmailLinkRecipient_token_key" ON "MessagingEmailLinkRecipient"("token");

-- CreateIndex
CREATE INDEX "MessagingEmailLinkRecipient_linkId_idx" ON "MessagingEmailLinkRecipient"("linkId");

-- CreateIndex
CREATE INDEX "MessagingEmailLinkRecipient_recipientId_idx" ON "MessagingEmailLinkRecipient"("recipientId");

-- CreateIndex
CREATE INDEX "MessagingEmailEvent_emailId_occurredAt_idx" ON "MessagingEmailEvent"("emailId", "occurredAt");

-- CreateIndex
CREATE INDEX "MessagingEmailEvent_recipientId_idx" ON "MessagingEmailEvent"("recipientId");

-- CreateIndex
CREATE INDEX "MessagingEmailEvent_linkRecipientId_idx" ON "MessagingEmailEvent"("linkRecipientId");

-- CreateIndex
CREATE INDEX "SpamDetectionLog_userId_mailbox_idx" ON "SpamDetectionLog"("userId", "mailbox");

-- CreateIndex
CREATE INDEX "SpamSenderReputation_userId_idx" ON "SpamSenderReputation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpamSenderReputation_userId_domain_key" ON "SpamSenderReputation"("userId", "domain");

-- CreateIndex
CREATE INDEX "Client_userId_displayName_idx" ON "Client"("userId", "displayName");

-- CreateIndex
CREATE INDEX "Product_userId_name_idx" ON "Product"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_userId_sku_key" ON "Product"("userId", "sku");

-- CreateIndex
CREATE INDEX "Quote_userId_status_idx" ON "Quote"("userId", "status");

-- CreateIndex
CREATE INDEX "Quote_userId_clientId_idx" ON "Quote"("userId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_userId_number_key" ON "Quote"("userId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_quoteId_key" ON "Invoice"("quoteId");

-- CreateIndex
CREATE INDEX "Invoice_userId_status_idx" ON "Invoice"("userId", "status");

-- CreateIndex
CREATE INDEX "Invoice_userId_clientId_idx" ON "Invoice"("userId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_userId_number_key" ON "Invoice"("userId", "number");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "InvoiceAuditLog_userId_invoiceId_idx" ON "InvoiceAuditLog"("userId", "invoiceId");

-- CreateIndex
CREATE INDEX "NumberingSequence_userId_idx" ON "NumberingSequence"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NumberingSequence_userId_type_year_key" ON "NumberingSequence"("userId", "type", "year");

-- CreateIndex
CREATE INDEX "EmailLog_userId_documentType_idx" ON "EmailLog"("userId", "documentType");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES "PdfTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES "PdfTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteConfig" ADD CONSTRAINT "WebsiteConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingSettings" ADD CONSTRAINT "MessagingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingSavedResponse" ADD CONSTRAINT "MessagingSavedResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingAutoReplyLog" ADD CONSTRAINT "MessagingAutoReplyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingScheduledEmail" ADD CONSTRAINT "MessagingScheduledEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingScheduledAttachment" ADD CONSTRAINT "MessagingScheduledAttachment_scheduledEmailId_fkey" FOREIGN KEY ("scheduledEmailId") REFERENCES "MessagingScheduledEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingEmail" ADD CONSTRAINT "MessagingEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingEmailRecipient" ADD CONSTRAINT "MessagingEmailRecipient_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "MessagingEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingEmailLink" ADD CONSTRAINT "MessagingEmailLink_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "MessagingEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingEmailLinkRecipient" ADD CONSTRAINT "MessagingEmailLinkRecipient_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MessagingEmailLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingEmailLinkRecipient" ADD CONSTRAINT "MessagingEmailLinkRecipient_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "MessagingEmailRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingEmailEvent" ADD CONSTRAINT "MessagingEmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "MessagingEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingEmailEvent" ADD CONSTRAINT "MessagingEmailEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "MessagingEmailRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingEmailEvent" ADD CONSTRAINT "MessagingEmailEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MessagingEmailLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingEmailEvent" ADD CONSTRAINT "MessagingEmailEvent_linkRecipientId_fkey" FOREIGN KEY ("linkRecipientId") REFERENCES "MessagingEmailLinkRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpamDetectionLog" ADD CONSTRAINT "SpamDetectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpamSenderReputation" ADD CONSTRAINT "SpamSenderReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberingSequence" ADD CONSTRAINT "NumberingSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

