import { Prisma } from "@prisma/client";
import { simpleParser, type ParsedMail } from "mailparser";
import type { ImapFlow, MessageAddressObject } from "imapflow";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type SpamMailbox = "inbox" | "sent" | "drafts" | "trash" | "spam";

const SPAM_THRESHOLD = 70;

type ImapAddress = MessageAddressObject & {
  mailbox?: string | null;
  host?: string | null;
};

const SUBJECT_KEYWORDS = [
  "gagner de l'argent",
  "offre spéciale",
  "crypto",
  "bitcoin",
  "lotterie",
  "casino",
  "urgent",
  "100% gratuit",
  "augmenter vos revenus",
  "travail à domicile",
];

const BODY_KEYWORDS = [
  "revenus passifs",
  "investissement garanti",
  "sexe",
  "viagra",
  "blockchain",
  "doublez vos gains",
  "rendement incroyable",
  "partenariat",
  "marketing d'affiliation",
  "sans risque",
];

const BLACKLISTED_DOMAINS = [
  "mail.ru",
  "qq.com",
  "spamtest.io",
  "scam-token.com",
];

const SUSPICIOUS_ATTACHMENT_EXTENSIONS = [
  ".exe",
  ".scr",
  ".js",
  ".bat",
  ".cmd",
  ".com",
  ".pif",
  ".jar",
];

const SUSPICIOUS_ARCHIVE_EXTENSIONS = [".zip", ".rar", ".7z"];

const SUSPICIOUS_MIME_KEYWORDS = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/java-archive",
  "application/x-sh",
  "application/x-dosexec",
  "application/vnd.microsoft.portable-executable",
  "application/zip",
  "application/x-zip-compressed",
];

async function resolveUserId(provided?: string) {
  if (provided) {
    return provided;
  }
  const user = await requireUser();
  return user.id;
}

export type SpamAnalysisResult = {
  score: number;
  reasons: string[];
  movedToSpam: boolean;
  alreadyLogged: boolean;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatEnvelopeAddress(entry?: ImapAddress | null): string | null {
  if (!entry) return null;
  const rawAddress =
    typeof entry.address === "string" ? entry.address.trim() : "";
  const mailbox =
    typeof entry.mailbox === "string" ? entry.mailbox.trim() : "";
  const host = typeof entry.host === "string" ? entry.host.trim() : "";
  const email =
    rawAddress.length > 0
      ? rawAddress
      : mailbox && host
        ? `${mailbox}@${host}`
        : "";
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  if (name && email) {
    return `${name} <${email}>`;
  }
  if (email) {
    return email;
  }
  if (name) {
    return name;
  }
  return null;
}

function extractDomain(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = address.match(/@([^>]+)>?$/);
  if (!match) return null;
  return match[1].trim().toLowerCase();
}

function countOccurrences(value: string, patterns: string[]): number {
  const lowered = normalize(value);
  return patterns.reduce((acc, keyword) => {
    return lowered.includes(normalize(keyword)) ? acc + 1 : acc;
  }, 0);
}

function countLinks(text: string): number {
  const matches = text.match(/https?:\/\//gi);
  return matches ? matches.length : 0;
}

function isDomainBlacklisted(domain: string | null): boolean {
  if (!domain) return false;
  const normalizedDomain = normalize(domain);
  return BLACKLISTED_DOMAINS.some((entry) => {
    const normalizedEntry = normalize(entry);
    return (
      normalizedDomain === normalizedEntry ||
      normalizedDomain.endsWith(`.${normalizedEntry}`)
    );
  });
}

function hasSuspiciousAttachments(
  attachments: ParsedMail["attachments"] | null | undefined,
): boolean {
  if (!attachments?.length) {
    return false;
  }
  return attachments.some((attachment) => {
    const normalizedFilename = normalize(attachment.filename ?? "");
    if (
      SUSPICIOUS_ATTACHMENT_EXTENSIONS.some((ext) =>
        normalizedFilename.endsWith(ext),
      ) ||
      SUSPICIOUS_ARCHIVE_EXTENSIONS.some((ext) =>
        normalizedFilename.endsWith(ext),
      )
    ) {
      return true;
    }
    const normalizedContentType = normalize(attachment.contentType ?? "");
    return SUSPICIOUS_MIME_KEYWORDS.some((keyword) =>
      normalizedContentType.includes(keyword),
    );
  });
}

function uppercaseRatio(text: string): number {
  if (!text) return 0;
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (!letters.length) return 0;
  const uppercase = letters.replace(/[^A-Z]/g, "");
  return uppercase.length / letters.length;
}

async function getSenderReputation(
  domain: string | null,
  userId: string,
): Promise<number> {
  if (!domain) return 0;
  const entry = await prisma.spamSenderReputation.findUnique({
    where: {
      userId_domain: {
        userId,
        domain,
      },
    },
  });
  if (!entry) return 0;
  const diff = entry.spamCount - entry.hamCount;
  return Math.max(-20, Math.min(30, diff * 5));
}

export async function updateSenderReputation(
  domain: string | null,
  isSpam: boolean,
  userId: string,
) {
  if (!domain) return;
  await prisma.spamSenderReputation.upsert({
    where: {
      userId_domain: {
        userId,
        domain,
      },
    },
    create: {
      userId,
      domain,
      spamCount: isSpam ? 1 : 0,
      hamCount: isSpam ? 0 : 1,
      lastFeedbackAt: new Date(),
    },
    update: {
      spamCount: { increment: isSpam ? 1 : 0 },
      hamCount: { increment: isSpam ? 0 : 1 },
      lastFeedbackAt: new Date(),
    },
  });
}

async function logDetection(options: {
  mailbox: SpamMailbox;
  targetMailbox?: SpamMailbox;
  uid: number;
  subject?: string;
  sender?: string;
  score: number;
  reasons: string[];
  autoMoved: boolean;
  manual: boolean;
  messageId?: string | null;
  userId: string;
}) {
  const data = {
    userId: options.userId,
    mailbox: options.mailbox,
    targetMailbox: options.targetMailbox,
    uid: options.uid,
    subject: options.subject,
    sender: options.sender,
    score: Math.round(options.score),
    threshold: SPAM_THRESHOLD,
    reasons: options.reasons,
    autoMoved: options.autoMoved,
    manual: options.manual,
    messageId: options.messageId ?? undefined,
  };

  try {
    await prisma.spamDetectionLog.create({ data });
    return;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (typeof error.meta?.target === "string"
        ? error.meta.target.includes("SpamDetectionLog")
        : Array.isArray(error.meta?.target) &&
          error.meta.target.some((target) => target.includes("SpamDetectionLog")))
    ) {
      await resetSpamDetectionLogSequence();
      await prisma.spamDetectionLog.create({ data });
      return;
    }
    throw error;
  }
}

async function resetSpamDetectionLogSequence() {
  try {
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"SpamDetectionLog"', 'id'),
        COALESCE((SELECT MAX("id") FROM "SpamDetectionLog"), 0)
      );
    `);
  } catch (sequenceError) {
    console.warn("Failed to reset SpamDetectionLog sequence", sequenceError);
  }
}

function calculateScore(parsed: ParsedMail, options: {
  subject: string;
  textContent: string;
  fromAddress: string | null;
  replyToAddress: string | null;
  attachmentsLength: number;
  domainReputation: number;
  hasBlacklistedDomain: boolean;
}): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const subjectMatches = countOccurrences(options.subject, SUBJECT_KEYWORDS);
  if (subjectMatches > 0) {
    score += subjectMatches * 20;
    reasons.push("Mots-clés suspects dans le sujet");
  }

  const bodyMatches = countOccurrences(options.textContent, BODY_KEYWORDS);
  if (bodyMatches > 0) {
    score += bodyMatches * 12;
    reasons.push("Mots-clés suspects dans le contenu");
  }

  const linkCount = countLinks(options.textContent);
  if (linkCount >= 5) {
    score += Math.min(30, linkCount * 4);
    reasons.push(`Nombre de liens élevé (${linkCount})`);
  }

  if (options.attachmentsLength > 2) {
    score += 10;
    reasons.push("Trop de pièces jointes");
  }

  if (uppercaseRatio(options.subject) > 0.6) {
    score += 10;
    reasons.push("Sujet avec majuscules excessives");
  }

  if (uppercaseRatio(options.textContent) > 0.5) {
    score += 10;
    reasons.push("Message avec majuscules excessives");
  }

  if (options.hasBlacklistedDomain) {
    score += 35;
    reasons.push("Domaine expéditeur sur liste noire");
  }

  if (options.domainReputation !== 0) {
    if (options.domainReputation > 0) {
      score += options.domainReputation;
      reasons.push("Mauvaise réputation du domaine expéditeur");
    } else {
      score += options.domainReputation; // négatif, récompense le domaine
    }
  }

  const fromDomain = extractDomain(options.fromAddress);
  const replyDomain = extractDomain(options.replyToAddress);
  if (fromDomain && replyDomain && fromDomain !== replyDomain) {
    score += 15;
    reasons.push("Adresse Reply-To différente de l'expéditeur");
  }

  if (hasSuspiciousAttachments(parsed.attachments)) {
    score += 20;
    reasons.push("Pièce jointe potentiellement dangereuse");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export async function analyzeAndHandleSpam(options: {
  userId?: string;
  client: ImapFlow;
  mailbox: SpamMailbox;
  uid: number;
  spamFilteringEnabled?: boolean;
}): Promise<SpamAnalysisResult> {
  const {
    userId: providedUserId,
    client,
    mailbox,
    uid,
    spamFilteringEnabled = true,
  } = options;

  if (!spamFilteringEnabled) {
    return { score: 0, reasons: [], movedToSpam: false, alreadyLogged: false };
  }

  const userId = await resolveUserId(providedUserId);

  const previousLog = await prisma.spamDetectionLog.findFirst({
    where: {
      userId,
      mailbox,
      uid,
      manual: false,
    },
    orderBy: { detectedAt: "desc" },
  });

  if (previousLog) {
    return {
      score: previousLog.score,
      reasons: Array.isArray(previousLog.reasons)
        ? (previousLog.reasons as string[])
        : [],
      movedToSpam: previousLog.targetMailbox === "spam",
      alreadyLogged: true,
    };
  }

  const result = await client.fetchOne(
    uid,
    {
      envelope: true,
      internalDate: true,
      flags: true,
      source: true,
    },
    { uid: true },
  );

  if (!result) {
    return {
      score: 0,
      reasons: ["Message introuvable"],
      movedToSpam: false,
      alreadyLogged: false,
    };
  }

  if (!result.source) {
    return { score: 0, reasons: ["Source introuvable"], movedToSpam: false, alreadyLogged: false };
  }

  const parsed = await simpleParser(result.source);
  const subject = result.envelope?.subject ?? parsed.subject ?? "";
  const from = result.envelope?.from?.[0] as ImapAddress | undefined;
  const fromAddress = formatEnvelopeAddress(from) ?? parsed.from?.text ?? null;
  const replyTo =
    result.envelope?.replyTo?.[0] as ImapAddress | undefined;
  const replyToAddress =
    formatEnvelopeAddress(replyTo) ?? parsed.replyTo?.text ?? null;

  const textContent = parsed.text || parsed.textAsHtml || parsed.html || "";
  const domain = extractDomain(fromAddress);
  const domainReputation = await getSenderReputation(domain, userId);
  const hasBlacklistedDomain = isDomainBlacklisted(domain);

  const { score, reasons } = calculateScore(parsed, {
    subject,
    textContent,
    fromAddress,
    replyToAddress,
    attachmentsLength: parsed.attachments?.length ?? 0,
    domainReputation,
    hasBlacklistedDomain,
  });

  const messageId = parsed.messageId ?? null;

  let movedToSpam = false;
  if (score >= SPAM_THRESHOLD) {
    const destinations = await client.list();
    const spamFolder = destinations.find((folder) => {
      const path = normalize(folder.path);
      return (
        path.includes("spam") ||
        path.includes("junk") ||
        path.includes("indesirable") ||
        path.includes("courrier indesirable")
      );
    });
    if (spamFolder) {
      const mailboxInfo = client.mailbox;
      const currentMailboxPath =
        mailboxInfo !== false ? mailboxInfo.path : null;
      const wasReadOnly =
        mailboxInfo !== false ? Boolean(mailboxInfo.readOnly) : false;
      if (wasReadOnly && currentMailboxPath) {
        try {
          await client.mailboxOpen(currentMailboxPath, { readOnly: false });
        } catch (error) {
          console.warn("Impossible de ré-ouvrir la boîte aux lettres en écriture pour déplacer le spam:", error);
        }
      }
      try {
        await client.messageMove(String(uid), spamFolder.path, { uid: true });
        movedToSpam = true;
        await updateSenderReputation(domain, true, userId);
      } catch (error) {
        console.warn("Déplacement automatique vers le dossier Spam impossible:", error);
      } finally {
        if (wasReadOnly && currentMailboxPath) {
          await client.mailboxOpen(currentMailboxPath, { readOnly: true }).catch(() => undefined);
        }
      }
    }
  }

  await logDetection({
    userId,
    mailbox,
    targetMailbox: movedToSpam ? "spam" : undefined,
    uid,
    subject,
    sender: fromAddress ?? undefined,
    score,
    reasons,
    autoMoved: true,
    manual: false,
    messageId,
  });

  return { score, reasons, movedToSpam, alreadyLogged: false };
}

export async function recordManualSpamFeedback(options: {
  mailbox: SpamMailbox;
  target: SpamMailbox;
  uid: number;
  subject?: string;
  sender?: string;
  messageId?: string | null;
  userId?: string;
}) {
  const userId = await resolveUserId(options.userId);
  const isSpam = options.target === "spam";
  const domain = extractDomain(options.sender ?? null);
  await updateSenderReputation(domain, isSpam, userId);
  await logDetection({
    userId,
    mailbox: options.mailbox,
    targetMailbox: options.target,
    uid: options.uid,
    subject: options.subject,
    sender: options.sender,
    score: isSpam ? 90 : 10,
    reasons: [isSpam ? "Marqué comme spam manuellement" : "Marqué comme légitime"],
    autoMoved: false,
    manual: true,
    messageId: options.messageId,
  });
}

export const __testables = {
  calculateScore,
  countOccurrences,
  extractDomain,
  hasSuspiciousAttachments,
  isDomainBlacklisted,
  normalize,
};
