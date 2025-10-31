import { simpleParser, type ParsedMail } from "mailparser";
import type { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";

export type SpamMailbox = "inbox" | "sent" | "drafts" | "trash" | "spam";

const SPAM_THRESHOLD = 70;

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

function uppercaseRatio(text: string): number {
  if (!text) return 0;
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (!letters.length) return 0;
  const uppercase = letters.replace(/[^A-Z]/g, "");
  return uppercase.length / letters.length;
}

function getRepos() {
  const spamDetectionLog = (prisma as any).spamDetectionLog;
  const spamSenderReputation = (prisma as any).spamSenderReputation;
  return { spamDetectionLog, spamSenderReputation };
}

async function getSenderReputation(domain: string | null): Promise<number> {
  if (!domain) return 0;
  const { spamSenderReputation } = getRepos();
  if (!spamSenderReputation?.findUnique) {
    return 0;
  }
  const entry = await spamSenderReputation.findUnique({
    where: { domain },
  });
  if (!entry) return 0;
  const diff = entry.spamCount - entry.hamCount;
  return Math.max(-20, Math.min(30, diff * 5));
}

export async function updateSenderReputation(domain: string | null, isSpam: boolean) {
  if (!domain) return;
  const { spamSenderReputation } = getRepos();
  if (!spamSenderReputation?.upsert) {
    return;
  }
  await spamSenderReputation.upsert({
    where: { domain },
    create: {
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
}) {
  const { spamDetectionLog } = getRepos();
  if (!spamDetectionLog?.create) {
    return;
  }
  await spamDetectionLog.create({
    data: {
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
    },
  });
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
      score += options.domainReputation; // négatif
      reasons.push("Réputation positive du domaine expéditeur");
    }
  }

  const fromDomain = extractDomain(options.fromAddress);
  const replyDomain = extractDomain(options.replyToAddress);
  if (fromDomain && replyDomain && fromDomain !== replyDomain) {
    score += 15;
    reasons.push("Adresse Reply-To différente de l'expéditeur");
  }

  const attachmentTypes = (parsed.attachments ?? []).map((attachment) => normalize(attachment.contentType));
  if (attachmentTypes.some((type) => type.includes(".exe") || type.includes(".scr") || type.includes(".zip"))) {
    score += 20;
    reasons.push("Pièce jointe potentiellement dangereuse");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export async function analyzeAndHandleSpam(options: {
  client: ImapFlow;
  mailbox: SpamMailbox;
  uid: number;
}): Promise<SpamAnalysisResult> {
  const { client, mailbox, uid } = options;
  const { spamDetectionLog } = getRepos();
  if (!spamDetectionLog?.findFirst) {
    return { score: 0, reasons: [], movedToSpam: false, alreadyLogged: true };
  }
  const previousLog = await spamDetectionLog.findFirst({
    where: {
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

  if (!result?.source) {
    return { score: 0, reasons: ["Source introuvable"], movedToSpam: false, alreadyLogged: false };
  }

  const parsed = await simpleParser(result.source);
  const subject = result.envelope?.subject ?? parsed.subject ?? "";
  const from = result.envelope?.from?.[0];
  const fromAddress = from
    ? `${from.name ?? ""} <${from.mailbox}@${from.host}>`
    : parsed.from?.text ?? null;
  const replyTo = result.envelope?.replyTo?.[0];
  const replyToAddress = replyTo
    ? `${replyTo.name ?? ""} <${replyTo.mailbox}@${replyTo.host}>`
    : parsed.replyTo?.text ?? null;

  const textContent = parsed.text || parsed.textAsHtml || parsed.html || "";
  const domain = extractDomain(fromAddress);
  const domainReputation = await getSenderReputation(domain);
  const hasBlacklistedDomain = domain ? BLACKLISTED_DOMAINS.includes(domain) : false;

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
      await client.messageMove(String(uid), spamFolder.path, { uid: true });
      movedToSpam = true;
      await updateSenderReputation(domain, true);
    }
  }

  await logDetection({
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
}) {
  const { spamDetectionLog } = getRepos();
  if (!spamDetectionLog?.create) {
    return;
  }
  const isSpam = options.target === "spam";
  const domain = extractDomain(options.sender ?? null);
  await updateSenderReputation(domain, isSpam);
  await logDetection({
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
