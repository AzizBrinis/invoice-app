import {
  ImapFlow,
  type MessageStructureObject,
  type MessageAddressObject,
} from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/server/secure-credentials";

const SETTINGS_ID = 1;
const DEFAULT_PAGE_SIZE = 20;

export type MessagingSettingsInput = {
  fromEmail: string;
  senderName: string;
  senderLogoUrl: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
};

export type MessagingSettingsSummary = {
  fromEmail: string;
  senderName: string;
  senderLogoUrl: string | null;
  imapHost: string;
  imapPort: number | null;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number | null;
  smtpSecure: boolean;
  imapConfigured: boolean;
  smtpConfigured: boolean;
};

export type Mailbox = "inbox" | "sent";

export type MailboxListItem = {
  uid: number;
  subject: string;
  from: string | null;
  to: string[];
  date: string;
  seen: boolean;
  hasAttachments: boolean;
};

export type MailboxPageResult = {
  mailbox: Mailbox;
  page: number;
  pageSize: number;
  totalMessages: number;
  hasMore: boolean;
  messages: MailboxListItem[];
};

export type MessageDetailAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type MessageDetail = {
  mailbox: Mailbox;
  uid: number;
  subject: string;
  from: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  date: string;
  seen: boolean;
  html: string | null;
  text: string | null;
  attachments: MessageDetailAttachment[];
};

export type ComposeEmailInput = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
};

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type ImapConnectionConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
};

export type SmtpConnectionConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail?: string | null;
};

type MessagingCredentials = {
  fromEmail: string | null;
  senderName: string | null;
  senderLogoUrl: string | null;
  imap: ImapConnectionConfig | null;
  smtp: SmtpConnectionConfig | null;
};

type MailboxOpenResult = {
  name: string;
  info: Awaited<ReturnType<ImapFlow["mailboxOpen"]>>;
  release: () => void;
};

const MAILBOX_CANDIDATES: Record<Mailbox, string[]> = {
  inbox: ["INBOX"],
  sent: [
    "Sent",
    "Sent Messages",
    "Sent Items",
    "Envoyés",
    "[Gmail]/Sent Mail",
    "INBOX.Sent",
  ],
};

function ensureNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Le champ ${field} est requis.`);
  }
  return trimmed;
}

function ensurePort(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`Le port ${field} est invalide.`);
  }
  return value;
}

function toOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapEmailHtml(
  contentHtml: string,
  options: {
    senderName: string | null;
    senderLogoUrl: string | null;
    fromEmail: string | null;
  },
): string {
  const { senderName, senderLogoUrl, fromEmail } = options;
  const displayName = senderName?.trim() ?? "";
  const email = fromEmail ?? "";

  const logoHtml = senderLogoUrl
    ? `<img src="${escapeHtml(senderLogoUrl)}" alt="Logo expéditeur" style="height:40px;width:auto;border-radius:6px;" />`
    : "";

  const headerContent =
    displayName || email
      ? `<div style="display:flex;flex-direction:column;">
          ${
            displayName
              ? `<span style="font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(displayName)}</span>`
              : ""
          }
          ${
            email
              ? `<span style="font-size:12px;color:#475569;">${escapeHtml(email)}</span>`
              : ""
          }
        </div>`
      : "";

  const headerHtml =
    logoHtml || headerContent
      ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          ${logoHtml}
          ${headerContent}
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light dark" />
    <title>Message</title>
  </head>
  <body style="margin:0;padding:32px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:white;padding:32px;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
      ${headerHtml}
      <div style="font-size:15px;line-height:1.6;color:#0f172a;">
        ${contentHtml}
      </div>
    </div>
  </body>
</html>`;
}

function formatError(prefix: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`${prefix}: ${error.message}`);
  }
  return new Error(`${prefix}: erreur inconnue`);
}

function isAuthError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /auth|login failed|invalid credentials/i.test(message);
}

function formatAddress(
  entry?: Pick<MessageAddressObject, "name" | "mailbox" | "host"> | null,
): string | null {
  if (!entry) {
    return null;
  }
  const email =
    entry.mailbox && entry.host
      ? `${entry.mailbox}@${entry.host}`
      : undefined;
  if (entry.name && email) {
    return `${entry.name} <${email}>`;
  }
  if (entry.name) {
    return entry.name;
  }
  return email ?? null;
}

function formatAddressList(
  list?: Array<Pick<MessageAddressObject, "name" | "mailbox" | "host">>,
): string[] {
  if (!list?.length) {
    return [];
  }
  return list
    .map((entry) => formatAddress(entry))
    .filter((value): value is string => Boolean(value));
}

function hasAttachments(
  structure:
    | MessageStructureObject
    | MessageStructureObject[]
    | null
    | undefined,
): boolean {
  if (!structure) return false;
  if (Array.isArray(structure)) {
    return structure.some((child) => hasAttachments(child));
  }
  const disposition = structure.disposition
    ? String(structure.disposition).toLowerCase()
    : "";
  if (disposition === "attachment") {
    return true;
  }
  if (structure.childNodes?.length) {
    return structure.childNodes.some((child) => hasAttachments(child));
  }
  return false;
}

async function withImapClient<T>(
  config: ImapConnectionConfig,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

async function openMailbox(
  client: ImapFlow,
  mailbox: Mailbox,
  readOnly: boolean,
): Promise<MailboxOpenResult | null> {
  const candidates = MAILBOX_CANDIDATES[mailbox];
  for (const name of candidates) {
    const lock = await client.getMailboxLock(name);
    try {
      const info = await client.mailboxOpen(name, { readOnly });
      return {
        name,
        info,
        release: () => lock.release(),
      };
    } catch (error) {
      lock.release();
      if (mailbox === "sent" && isAuthError(error)) {
        throw error;
      }
    }
  }
  return null;
}

async function getMessagingCredentials(): Promise<MessagingCredentials> {
  const settings = await prisma.messagingSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    return {
      fromEmail: null,
      imap: null,
      smtp: null,
    };
  }

  const decrypt = (value: string | null | undefined) => {
    try {
      return decryptSecret(value) ?? null;
    } catch (error) {
      throw formatError(
        "Impossible de déchiffrer les identifiants de messagerie",
        error,
      );
    }
  };

  const imapUser = decrypt(settings.imapUser);
  const imapPassword = decrypt(settings.imapPassword);
  const smtpUser = decrypt(settings.smtpUser);
  const smtpPassword = decrypt(settings.smtpPassword);

  return {
    fromEmail: settings.fromEmail,
    senderName: settings.senderName ?? null,
    senderLogoUrl: settings.senderLogoUrl ?? null,
    imap:
      settings.imapHost &&
      settings.imapPort &&
      imapUser &&
      imapPassword
        ? {
            host: settings.imapHost,
            port: settings.imapPort,
            secure: settings.imapSecure,
            user: imapUser,
            password: imapPassword,
          }
        : null,
    smtp:
      settings.smtpHost &&
      settings.smtpPort &&
      smtpUser &&
      smtpPassword
        ? {
            host: settings.smtpHost,
            port: settings.smtpPort,
            secure: settings.smtpSecure,
            user: smtpUser,
            password: smtpPassword,
            fromEmail: settings.fromEmail,
          }
        : null,
  };
}

export async function getMessagingSettingsSummary(): Promise<MessagingSettingsSummary> {
  const settings = await prisma.messagingSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    return {
      fromEmail: "",
      senderName: "",
      senderLogoUrl: null,
      imapHost: "",
      imapPort: null,
      imapSecure: true,
      smtpHost: "",
      smtpPort: null,
      smtpSecure: true,
      imapConfigured: false,
      smtpConfigured: false,
    };
  }

  return {
    fromEmail: settings.fromEmail ?? "",
    senderName: settings.senderName ?? "",
    senderLogoUrl: settings.senderLogoUrl ?? null,
    imapHost: settings.imapHost ?? "",
    imapPort: settings.imapPort,
    imapSecure: settings.imapSecure,
    smtpHost: settings.smtpHost ?? "",
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    imapConfigured:
      Boolean(settings.imapHost) &&
      Boolean(settings.imapPort) &&
      Boolean(settings.imapUser) &&
      Boolean(settings.imapPassword),
    smtpConfigured:
      Boolean(settings.smtpHost) &&
      Boolean(settings.smtpPort) &&
      Boolean(settings.smtpUser) &&
      Boolean(settings.smtpPassword),
  };
}

export async function saveMessagingSettings(
  input: MessagingSettingsInput,
): Promise<void> {
  const {
    fromEmail,
    senderName,
    senderLogoUrl,
    imapHost,
    imapPort,
    imapSecure,
    imapUser,
    imapPassword,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPassword,
  } = input;

  const sanitizedFromEmail = ensureNonEmpty(fromEmail, "Adresse e-mail");
  const sanitizedImapHost = ensureNonEmpty(imapHost, "Serveur IMAP");
  const sanitizedImapUser = ensureNonEmpty(imapUser, "Identifiant IMAP");
  const sanitizedImapPassword = ensureNonEmpty(
    imapPassword,
    "Mot de passe IMAP",
  );
  const sanitizedSmtpHost = ensureNonEmpty(smtpHost, "Serveur SMTP");
  const sanitizedSmtpUser = ensureNonEmpty(smtpUser, "Identifiant SMTP");
  const sanitizedSmtpPassword = ensureNonEmpty(
    smtpPassword,
    "Mot de passe SMTP",
  );
  const validatedImapPort = ensurePort(imapPort, "IMAP");
  const validatedSmtpPort = ensurePort(smtpPort, "SMTP");
  const normalizedSenderName = senderName.trim();
  const normalizedSenderLogoUrl = toOptionalString(senderLogoUrl);

  await prisma.messagingSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      fromEmail: sanitizedFromEmail,
      senderName: normalizedSenderName,
      senderLogoUrl: normalizedSenderLogoUrl,
      imapHost: sanitizedImapHost,
      imapPort: validatedImapPort,
      imapSecure,
      imapUser: encryptSecret(sanitizedImapUser),
      imapPassword: encryptSecret(sanitizedImapPassword),
      smtpHost: sanitizedSmtpHost,
      smtpPort: validatedSmtpPort,
      smtpSecure,
      smtpUser: encryptSecret(sanitizedSmtpUser),
      smtpPassword: encryptSecret(sanitizedSmtpPassword),
    },
    create: {
      id: SETTINGS_ID,
      fromEmail: sanitizedFromEmail,
      senderName: normalizedSenderName,
      senderLogoUrl: normalizedSenderLogoUrl,
      imapHost: sanitizedImapHost,
      imapPort: validatedImapPort,
      imapSecure,
      imapUser: encryptSecret(sanitizedImapUser),
      imapPassword: encryptSecret(sanitizedImapPassword),
      smtpHost: sanitizedSmtpHost,
      smtpPort: validatedSmtpPort,
      smtpSecure,
      smtpUser: encryptSecret(sanitizedSmtpUser),
      smtpPassword: encryptSecret(sanitizedSmtpPassword),
    },
  });
}

export async function fetchMailboxMessages(params: {
  mailbox: Mailbox;
  page?: number;
  pageSize?: number;
}): Promise<MailboxPageResult> {
  const credentials = await getMessagingCredentials();
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true);
    if (!opened) {
      return {
        mailbox: params.mailbox,
        page,
        pageSize,
        totalMessages: 0,
        hasMore: false,
        messages: [],
      };
    }

    try {
      const totalMessages = opened.info.exists ?? 0;
      if (totalMessages === 0) {
        return {
          mailbox: params.mailbox,
          page,
          pageSize,
          totalMessages: 0,
          hasMore: false,
          messages: [],
        };
      }

      const endSeq = Math.max(1, totalMessages - (page - 1) * pageSize);
      const startSeq = Math.max(1, endSeq - pageSize + 1);
      if (startSeq > endSeq) {
        return {
          mailbox: params.mailbox,
          page,
          pageSize,
          totalMessages,
          hasMore: false,
          messages: [],
        };
      }

      const range = `${startSeq}:${endSeq}`;
      const items: MailboxListItem[] = [];

      for await (const message of client.fetch(range, {
        envelope: true,
        internalDate: true,
        flags: true,
        bodyStructure: true,
      })) {
        const envelope = message.envelope;
        const from =
          formatAddress(envelope?.from?.[0]) ?? "Expéditeur inconnu";
        const to = formatAddressList(envelope?.to) ?? [];
        items.push({
          uid: message.uid,
          subject: envelope?.subject ?? "(Sans objet)",
          from,
          to,
          date: (message.internalDate ?? new Date()).toISOString(),
          seen: message.flags?.has("\\Seen") ?? false,
          hasAttachments: hasAttachments(message.bodyStructure),
        });
      }

      items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      return {
        mailbox: params.mailbox,
        page,
        pageSize,
        totalMessages,
        hasMore: startSeq > 1,
        messages: items,
      };
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

export async function fetchMessageDetail(params: {
  mailbox: Mailbox;
  uid: number;
}): Promise<MessageDetail> {
  const credentials = await getMessagingCredentials();
  if (!credentials.imap) {
    throw new Error(
      "Le serveur IMAP n'est pas configuré. Complétez les paramètres.",
    );
  }

  return withImapClient(credentials.imap, async (client) => {
    const opened = await openMailbox(client, params.mailbox, true);
    if (!opened) {
      throw new Error("Boîte aux lettres introuvable.");
    }

    try {
      const message = await client.fetchOne(
        params.uid,
        {
          envelope: true,
          internalDate: true,
          flags: true,
          source: true,
        },
        { uid: true },
      );

      if (!message?.source || !message.envelope) {
        throw new Error("Message introuvable.");
      }

      const parsed = await simpleParser(message.source);

      const sanitizedHtml = parsed.html
        ? sanitizeHtml(parsed.html, {
            allowedTags: [
              ...sanitizeHtml.defaults.allowedTags,
              "img",
              "table",
              "thead",
              "tbody",
              "tr",
              "td",
              "th",
              "span",
            ],
            allowedAttributes: {
              ...sanitizeHtml.defaults.allowedAttributes,
              a: ["href", "name", "target", "rel"],
              img: ["src", "alt", "title", "width", "height"],
              td: ["colspan", "rowspan"],
              th: ["colspan", "rowspan"],
            },
            allowedSchemes: ["http", "https", "mailto", "data"],
            transformTags: {
              a: sanitizeHtml.simpleTransform(
                "a",
                { target: "_blank", rel: "noopener noreferrer" },
                true,
              ),
            },
          })
        : null;

      return {
        mailbox: params.mailbox,
        uid: params.uid,
        subject: message.envelope.subject ?? "(Sans objet)",
        from: formatAddress(message.envelope.from?.[0]),
        to: formatAddressList(message.envelope.to),
        cc: formatAddressList(message.envelope.cc),
        bcc: formatAddressList(message.envelope.bcc),
        date: (message.internalDate ?? new Date()).toISOString(),
        seen: message.flags?.has("\\Seen") ?? false,
        html: sanitizedHtml,
        text: parsed.text ?? parsed.textAsHtml ?? null,
        attachments: parsed.attachments.map((attachment, index) => ({
          id:
            attachment.checksum ??
            `${params.mailbox}-${params.uid}-${index}`,
          filename:
            attachment.filename ?? `pièce-jointe-${index + 1}.bin`,
          contentType:
            attachment.contentType ?? "application/octet-stream",
          size: attachment.size ?? 0,
        })),
      };
    } finally {
      await client.mailboxClose().catch(() => undefined);
      opened.release();
    }
  });
}

export async function sendEmailMessage(
  params: ComposeEmailInput,
): Promise<void> {
  const credentials = await getMessagingCredentials();
  if (!credentials.smtp) {
    throw new Error(
      "Le serveur SMTP n'est pas configuré. Veuillez compléter les paramètres avant d'envoyer un message.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: credentials.smtp.host,
    port: credentials.smtp.port,
    secure: credentials.smtp.secure,
    auth: {
      user: credentials.smtp.user,
      pass: credentials.smtp.password,
    },
  });

  const fromAddress = credentials.smtp.fromEmail ?? credentials.smtp.user;
  const senderName = credentials.senderName?.trim() ?? "";
  const fromField = senderName
    ? { name: senderName, address: fromAddress }
    : fromAddress;

  const html = wrapEmailHtml(params.html, {
    senderName: credentials.senderName,
    senderLogoUrl: credentials.senderLogoUrl,
    fromEmail: fromAddress,
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from: fromField,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html,
  };

  if (params.cc?.length) {
    mailOptions.cc = params.cc;
  }
  if (params.bcc?.length) {
    mailOptions.bcc = params.bcc;
  }
  if (params.attachments?.length) {
    mailOptions.attachments = params.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    }));
  }

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw formatError("Échec de l'envoi du message", error);
  }
}

export async function testImapConnection(
  config: ImapConnectionConfig,
): Promise<void> {
  await withImapClient(
    {
      host: ensureNonEmpty(config.host, "Serveur IMAP"),
      port: ensurePort(config.port, "IMAP"),
      secure: config.secure,
      user: ensureNonEmpty(config.user, "Identifiant IMAP"),
      password: ensureNonEmpty(config.password, "Mot de passe IMAP"),
    },
    async (client) => {
      try {
        const opened = await openMailbox(client, "inbox", true);
        if (!opened) {
          throw new Error("Boîte de réception introuvable.");
        }

        try {
          // L'ouverture suffit pour vérifier la connexion IMAP
        } finally {
          await client.mailboxClose().catch(() => undefined);
          opened.release();
        }
      } catch (error) {
        throw formatError("Échec du test IMAP", error);
      }
    },
  );
}

export async function testSmtpConnection(
  config: SmtpConnectionConfig,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: ensureNonEmpty(config.host, "Serveur SMTP"),
    port: ensurePort(config.port, "SMTP"),
    secure: config.secure,
    auth: {
      user: ensureNonEmpty(config.user, "Identifiant SMTP"),
      pass: ensureNonEmpty(config.password, "Mot de passe SMTP"),
    },
  });

  try {
    await transporter.verify();
  } catch (error) {
    throw formatError("Échec du test SMTP", error);
  }
}
