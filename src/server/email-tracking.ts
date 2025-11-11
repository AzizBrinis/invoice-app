import { createHash, randomUUID } from "node:crypto";
import { load as loadHtml } from "cheerio";
import UAParser from "ua-parser-js";
import type {
  MessagingEmail,
  MessagingEmailEvent,
  MessagingEmailLink,
  MessagingEmailLinkRecipient,
  MessagingEmailRecipient,
  MessagingRecipientType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/env";

export type RecipientInput = {
  address: string;
  name: string | null;
  type: MessagingRecipientType;
};

export type PreparedRecipientPayload = {
  id: string;
  address: string;
  name: string | null;
  type: MessagingRecipientType;
  html: string;
  openToken: string;
};

export type PrepareEmailTrackingResult = {
  email: MessagingEmail;
  recipients: PreparedRecipientPayload[];
  links: MessagingEmailLink[];
};

export type EmailTrackingRecipientSummary = {
  id: string;
  address: string;
  name: string | null;
  type: MessagingRecipientType;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  clickCount: number;
  lastClickedAt: string | null;
};

export type EmailTrackingSummary = {
  emailId: string;
  messageId: string;
  trackingEnabled: boolean;
  sentAt: string;
  subject: string | null;
  totalOpens: number;
  totalClicks: number;
  recipients: EmailTrackingRecipientSummary[];
};

export type EmailTrackingDevice = {
  deviceFamily: string | null;
  deviceType: string | null;
  lastSeenAt: string;
};

export type EmailTrackingRecipientDetail = EmailTrackingRecipientSummary & {
  devices: EmailTrackingDevice[];
};

export type EmailTrackingLinkDetail = {
  id: string;
  url: string;
  position: number;
  totalClicks: number;
  recipients: Array<{
    recipientId: string;
    address: string;
    clickCount: number;
    lastClickedAt: string | null;
  }>;
};

export type EmailTrackingDetail = {
  emailId: string;
  messageId: string;
  trackingEnabled: boolean;
  sentAt: string;
  subject: string | null;
  totalOpens: number;
  totalClicks: number;
  recipients: EmailTrackingRecipientDetail[];
  links: EmailTrackingLinkDetail[];
};

type LinkDescriptor = {
  href: string;
  position: number;
};

const OPEN_DEDUP_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const CLICK_DEDUP_WINDOW_MS = 5 * 1000; // 5 seconds

const PROXY_OPEN_UA_HINTS = [
  /googleimageproxy/i,
  /google-web-preview/i,
  /google\-prox/i,
  /bingpreview/i,
  /preview\-fetcher/i,
  /linkpreview/i,
  /lightningrenderer/i,
];

const AUTOMATION_OPEN_UA_HINTS = [
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /java\//i,
  /okhttp\//i,
  /postmanruntime/i,
];

const LINK_SCANNER_UA_HINTS = [
  /proofpoint/i,
  /barracuda/i,
  /mimecast/i,
  /symantec/i,
  /messagelabs/i,
  /trend[\s-]?micro/i,
  /kaspersky/i,
  /bitdefender/i,
  /fortinet/i,
  /sophos/i,
  /fireeye/i,
  /mailguard/i,
  /urlscanner/i,
];

const HIDDEN_BLOCK_STYLE =
  "display:block !important;width:1px !important;height:1px !important;overflow:hidden !important;line-height:1px !important;font-size:1px !important;opacity:0 !important;";
const HIDDEN_INLINE_STYLE =
  "display:inline-block !important;width:1px !important;height:1px !important;overflow:hidden !important;line-height:1px !important;font-size:1px !important;opacity:0 !important;";
const PIXEL_IMAGE_STYLE =
  `${HIDDEN_INLINE_STYLE}outline:none !important;border:0 !important;-ms-interpolation-mode:bicubic;max-width:1px !important;max-height:1px !important;`;

function matchesUserAgentHints(
  userAgent: string | null | undefined,
  patterns: RegExp[],
): boolean {
  if (!userAgent) {
    return false;
  }
  return patterns.some((pattern) => pattern.test(userAgent));
}

function shouldSuppressOpenEvent(userAgent: string | null | undefined): boolean {
  return matchesUserAgentHints(userAgent, AUTOMATION_OPEN_UA_HINTS);
}

function isProxyOpenUserAgent(userAgent: string | null | undefined): boolean {
  return matchesUserAgentHints(userAgent, PROXY_OPEN_UA_HINTS);
}

function shouldSuppressClickEvent(userAgent: string | null | undefined): boolean {
  return matchesUserAgentHints(userAgent, LINK_SCANNER_UA_HINTS);
}

function hashFingerprint(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return createHash("sha256").update(normalized).digest("hex");
}

function isSelfOpen(params: {
  viewerUserId: string | null | undefined;
  emailUserId: string;
  viewerSessionHash: string | null;
  senderSessionHash: string | null;
  viewerIpHash: string | null;
  senderIpHash: string | null;
}): boolean {
  if (params.viewerUserId && params.viewerUserId === params.emailUserId) {
    return true;
  }
  if (
    params.viewerSessionHash &&
    params.senderSessionHash &&
    params.viewerSessionHash === params.senderSessionHash
  ) {
    return true;
  }
  if (
    params.viewerIpHash &&
    params.senderIpHash &&
    params.viewerIpHash === params.senderIpHash
  ) {
    return true;
  }
  return false;
}

function extractTrackableLinks(html: string): LinkDescriptor[] {
  const $ = loadHtml(html);
  const descriptors: LinkDescriptor[] = [];

  $("a[href]").each((index, element) => {
    const link = $(element);
    const href = (link.attr("href") ?? "").trim();
    if (!href) {
      return;
    }
    if (!/^https?:\/\//i.test(href)) {
      return;
    }
    descriptors.push({
      href,
      position: descriptors.length,
    });
  });

  return descriptors;
}

function appendQueryParam(url: string, key: string, value: string): string {
  const [base, hash] = url.split("#");
  const separator = base.includes("?") ? "&" : "?";
  const augmented = `${base}${separator}${key}=${encodeURIComponent(value)}`;
  return hash ? `${augmented}#${hash}` : augmented;
}

function buildOpenPixelMarkup(openPixelUrl: string): string {
  const baseImg = appendQueryParam(openPixelUrl, "variant", "img");
  const fallbackImg = appendQueryParam(openPixelUrl, "variant", "fallback");
  const backgroundImg = appendQueryParam(openPixelUrl, "variant", "bg");
  const noscriptImg = appendQueryParam(openPixelUrl, "variant", "noscript");
  const tableBg = appendQueryParam(openPixelUrl, "variant", "table");
  const msoBg = appendQueryParam(openPixelUrl, "variant", "mso");
  const fontProbe = appendQueryParam(openPixelUrl, "variant", "font");
  const cssProbe = appendQueryParam(openPixelUrl, "variant", "css");
  const importProbe = appendQueryParam(openPixelUrl, "variant", "import");

  const scope = createHash("sha1").update(openPixelUrl).digest("hex").slice(0, 10);
  const fontFamily = `et-font-${scope}`;
  const className = `et-probe-${scope}`;

  const hiddenContainerStyle = `${HIDDEN_BLOCK_STYLE}margin:0 !important;padding:0 !important;`; // keeps footprint predictable

  return [
    `<img src="${baseImg}" alt="" width="1" height="1" style="${PIXEL_IMAGE_STYLE}" data-tracking="open-pixel"/>`,
    `<div aria-hidden="true" style="${hiddenContainerStyle}">`,
    `<img src="${fallbackImg}" alt="" width="1" height="1" style="${PIXEL_IMAGE_STYLE}" data-tracking="open-pixel-fallback"/>`,
    `</div>`,
    `<span aria-hidden="true" style="${HIDDEN_INLINE_STYLE}background:url('${backgroundImg}') no-repeat 0 0 / 1px 1px;"></span>`,
    `<noscript><img src="${noscriptImg}" alt="" width="1" height="1" style="${PIXEL_IMAGE_STYLE}" data-tracking="open-pixel-noscript"/></noscript>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="1" height="1" aria-hidden="true" style="mso-hide:all;line-height:0 !important;font-size:0 !important;border-collapse:collapse !important;"><tr><td background="${tableBg}" style="padding:0;margin:0;line-height:0;font-size:0;width:1px;height:1px;">&nbsp;</td></tr></table>`,
    `<!--[if mso]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:1px;height:1px;"><v:fill type="frame" src="${msoBg}" color="#ffffff" /><v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0"><p style="font-size:1px;line-height:1px;color:#ffffff;">&nbsp;</p></v:textbox></v:rect><![endif]-->`,
    `<style type="text/css">@font-face { font-family:'${fontFamily}'; src:url('${fontProbe}') format('woff2'); font-weight:400; font-style:normal; font-display:block; } .${className} { font-family:'${fontFamily}', monospace !important; font-size:1px !important; line-height:1px !important; color:transparent !important; display:inline-block !important; width:1px !important; height:1px !important; overflow:hidden !important; letter-spacing:0 !important; } .${className}::after { content:''; display:block !important; width:1px !important; height:1px !important; background-image:url('${cssProbe}'); background-repeat:no-repeat !important; background-size:1px 1px !important; }</style>`,
    `<style type="text/css">@import url('${importProbe}');</style>`,
    `<span class="${className}" aria-hidden="true">et</span>`,
  ].join("");
}

function injectTrackingIntoHtml(params: {
  html: string;
  openPixelUrl: string | null;
  linkUrls: Map<number, string>;
}): string {
  const { html, openPixelUrl, linkUrls } = params;
  const $ = loadHtml(html);

  if (openPixelUrl) {
    const pixelElement = buildOpenPixelMarkup(openPixelUrl);
    const body = $("body");
    if (body.length) {
      body.append(pixelElement);
    } else {
      $.root().append(pixelElement);
    }
  }

  let linkIndex = 0;
  $("a[href]").each((_, element) => {
    const link = $(element);
    const currentHref = (link.attr("href") ?? "").trim();
    if (!currentHref || !/^https?:\/\//i.test(currentHref)) {
      return;
    }
    const trackedHref = linkUrls.get(linkIndex);
    if (trackedHref) {
      link.attr("href", trackedHref);
      link.attr("data-tracked", "messagerie");
    }
    linkIndex += 1;
  });

  const serialized = $.html();
  return serialized.startsWith("<!DOCTYPE html>")
    ? serialized
    : `<!DOCTYPE html>\n${serialized}`;
}

type DeviceEventLike = Pick<
  MessagingEmailEvent,
  "deviceFamily" | "deviceType" | "occurredAt"
>;

function createDeviceSummary(event: DeviceEventLike): EmailTrackingDevice {
  return {
    deviceFamily: event.deviceFamily,
    deviceType: event.deviceType,
    lastSeenAt: event.occurredAt.toISOString(),
  };
}

function parseDevice(userAgent: string | null | undefined): {
  deviceFamily: string | null;
  deviceType: string | null;
} {
  if (!userAgent) {
    return { deviceFamily: null, deviceType: null };
  }
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  const os = parser.getOS();
  const browser = parser.getBrowser();

  const pieces = [
    device.vendor,
    device.model,
    os.name,
    browser.name,
  ].filter(Boolean);

  const family =
    pieces.length > 0 ? pieces.join(" ") : (browser.name ?? os.name ?? null);

  return {
    deviceFamily: family,
    deviceType: device.type ?? null,
  };
}

async function ensureImplicitOpenFromClick(params: {
  tx: Prisma.TransactionClient;
  recipient: MessagingEmailRecipient;
  occurredAt: Date;
  device: { deviceFamily: string | null; deviceType: string | null };
  userAgent: string | null;
}) {
  const { tx, recipient, occurredAt, device, userAgent } = params;
  const updated = await tx.messagingEmailRecipient.updateMany({
    where: { id: recipient.id, openCount: 0 },
    data: {
      openCount: { increment: 1 },
      firstOpenedAt: recipient.firstOpenedAt ?? occurredAt,
      lastOpenedAt: occurredAt,
    },
  });

  if (updated.count > 0) {
    await tx.messagingEmailEvent.create({
      data: {
        emailId: recipient.emailId,
        recipientId: recipient.id,
        type: "OPEN",
        userAgent,
        deviceFamily: device.deviceFamily,
        deviceType: device.deviceType,
        occurredAt,
      },
    });

    console.log("[email-tracking] inferred open from click", {
      recipientId: recipient.id,
      emailId: recipient.emailId,
      userAgent: userAgent ?? null,
      deviceFamily: device.deviceFamily,
      deviceType: device.deviceType,
    });
  }
}

export async function prepareEmailTracking(params: {
  userId: string;
  messageId: string;
  subject: string | null;
  sentAt: Date;
  html: string;
  recipients: RecipientInput[];
  trackingEnabled: boolean;
  senderSessionToken?: string | null;
  senderIpAddress?: string | null;
}): Promise<PrepareEmailTrackingResult> {
  const {
    userId,
    messageId,
    subject,
    sentAt,
    html,
    recipients,
    trackingEnabled,
    senderSessionToken,
    senderIpAddress,
  } = params;

  if (!recipients.length) {
    throw new Error("Aucun destinataire fourni pour l'e-mail à tracer.");
  }

  const baseUrl = trackingEnabled ? getAppBaseUrl() : null;
  const linkDescriptors = trackingEnabled ? extractTrackableLinks(html) : [];
  const senderSessionHash = hashFingerprint(senderSessionToken);
  const senderIpHash = hashFingerprint(senderIpAddress);

  return await prisma.$transaction(async (tx) => {
    const email = await tx.messagingEmail.create({
      data: {
        userId,
        messageId,
        subject,
        sentAt,
        trackingEnabled,
        senderSessionHash,
        senderIpHash,
        recipients: {
          create: recipients.map((recipient) => ({
            address: recipient.address,
            name: recipient.name,
            type: recipient.type,
            openToken: randomUUID(),
          })),
        },
      },
      include: {
        recipients: true,
      },
    });

    const createdRecipients = email.recipients;

    let linkRecords: MessagingEmailLink[] = [];
    const linkRecipientTokens = new Map<string, Map<number, string>>();
    const linkRecipientRows: Prisma.MessagingEmailLinkRecipientCreateManyInput[] = [];

    if (trackingEnabled && linkDescriptors.length > 0) {
      linkRecords = await Promise.all(
        linkDescriptors.map((descriptor, index) =>
          tx.messagingEmailLink.create({
            data: {
              emailId: email.id,
              url: descriptor.href,
              position: index,
            },
          }),
        ),
      );

      for (const recipient of createdRecipients) {
        const map = new Map<number, string>();
        linkRecipientTokens.set(recipient.id, map);
        for (const linkRecord of linkRecords) {
          const token = randomUUID();
          map.set(linkRecord.position, token);
          linkRecipientRows.push({
            linkId: linkRecord.id,
            recipientId: recipient.id,
            token,
          });
        }
      }

      if (linkRecipientRows.length) {
        const BATCH_SIZE = 500;
        for (let index = 0; index < linkRecipientRows.length; index += BATCH_SIZE) {
          const batch = linkRecipientRows.slice(index, index + BATCH_SIZE);
          await tx.messagingEmailLinkRecipient.createMany({
            data: batch,
          });
        }
      }
    }

    const preparedRecipients: PreparedRecipientPayload[] =
      createdRecipients.map((recipient) => {
        const linkUrlMap = new Map<number, string>();

        if (trackingEnabled && baseUrl) {
          const tokens = linkRecipientTokens.get(recipient.id);
          if (tokens) {
            tokens.forEach((token, position) => {
              linkUrlMap.set(
                position,
                `${baseUrl}/api/email/track-click/${token}`,
              );
            });
          }
        }

        const openPixelUrl =
          trackingEnabled && baseUrl
            ? `${baseUrl}/api/email/track-open/${recipient.openToken}.png`
            : null;

        const customizedHtml =
          trackingEnabled && (openPixelUrl || linkUrlMap.size > 0)
            ? injectTrackingIntoHtml({
                html,
                openPixelUrl,
                linkUrls: linkUrlMap,
              })
            : html;

        return {
          id: recipient.id,
          address: recipient.address,
          name: recipient.name,
          type: recipient.type,
          html: customizedHtml,
          openToken: recipient.openToken,
        };
      });

    return {
      email,
      recipients: preparedRecipients,
      links: linkRecords,
    };
  });
}

export async function recordOpenEvent(params: {
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  sessionToken?: string | null;
  viewerUserId?: string | null;
}): Promise<MessagingEmailRecipient | null> {
  const recipient = await prisma.messagingEmailRecipient.findUnique({
    where: { openToken: params.token },
    include: {
      email: {
        select: {
          id: true,
          userId: true,
          senderSessionHash: true,
          senderIpHash: true,
        },
      },
    },
  });
  if (!recipient) {
    return null;
  }
  const email = recipient.email;

  const proxyHit = isProxyOpenUserAgent(params.userAgent);

  if (shouldSuppressOpenEvent(params.userAgent)) {
    console.log("[email-tracking] automated open ignored", {
      recipientId: recipient.id,
      emailId: recipient.emailId,
      address: recipient.address,
      userAgent: params.userAgent ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    return recipient;
  }

  if (
    email &&
    isSelfOpen({
      viewerUserId: params.viewerUserId,
      emailUserId: email.userId,
      viewerSessionHash: hashFingerprint(params.sessionToken),
      senderSessionHash: email.senderSessionHash,
      viewerIpHash: hashFingerprint(params.ipAddress),
      senderIpHash: email.senderIpHash,
    })
  ) {
    console.log("[email-tracking] sender open ignored", {
      recipientId: recipient.id,
      emailId: recipient.emailId,
      userId: email.userId,
      viewerUserId: params.viewerUserId ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    return recipient;
  }

  const now = new Date();
  const device = parseDevice(params.userAgent);

  const recentEvent = await prisma.messagingEmailEvent.findFirst({
    where: { recipientId: recipient.id, type: "OPEN" },
    orderBy: { occurredAt: "desc" },
  });

  if (recentEvent) {
    const elapsed = now.getTime() - recentEvent.occurredAt.getTime();
    const sameUserAgent =
      (recentEvent.userAgent ?? "") === (params.userAgent ?? "");
    const sameDeviceFamily =
      (recentEvent.deviceFamily ?? null) === device.deviceFamily;
    const sameDeviceType =
      (recentEvent.deviceType ?? null) === device.deviceType;
    if (
      elapsed >= 0 &&
      elapsed < OPEN_DEDUP_WINDOW_MS &&
      (sameUserAgent || (sameDeviceFamily && sameDeviceType))
    ) {
      console.log("[email-tracking] duplicate open ignored", {
        recipientId: recipient.id,
        emailId: recipient.emailId,
        elapsedMs: elapsed,
        userAgent: params.userAgent ?? null,
        deviceFamily: device.deviceFamily,
        deviceType: device.deviceType,
        ipAddress: params.ipAddress ?? null,
      });
      return recipient;
    }
  }

  console.log("[email-tracking] record open", {
    recipientId: recipient.id,
    emailId: recipient.emailId,
    address: recipient.address,
    userAgent: params.userAgent ?? null,
    deviceFamily: device.deviceFamily,
    deviceType: device.deviceType,
    ipAddress: params.ipAddress ?? null,
    viaProxy: proxyHit,
  });

  await prisma.$transaction(async (tx) => {
    await tx.messagingEmailRecipient.update({
      where: { id: recipient.id },
      data: {
        openCount: { increment: 1 },
        firstOpenedAt: recipient.firstOpenedAt ?? now,
        lastOpenedAt: now,
      },
    });

    await tx.messagingEmailEvent.create({
      data: {
        emailId: recipient.emailId,
        recipientId: recipient.id,
        type: "OPEN",
        userAgent: params.userAgent,
        deviceFamily: device.deviceFamily,
        deviceType: device.deviceType,
        occurredAt: now,
      },
    });
  });

  return recipient;
}

export async function recordClickEvent(params: {
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
}): Promise<{
  url: string;
  linkRecipient: MessagingEmailLinkRecipient;
  recipient: MessagingEmailRecipient;
} | null> {
  const linkRecipient =
    await prisma.messagingEmailLinkRecipient.findUnique({
      where: { token: params.token },
      include: {
        link: true,
        recipient: true,
      },
  });

  if (!linkRecipient || !linkRecipient.link || !linkRecipient.recipient) {
    console.warn("[email-tracking] click token introuvable", { token: params.token });
    return null;
  }

  if (shouldSuppressClickEvent(params.userAgent)) {
    console.log("[email-tracking] automated click ignored", {
      linkRecipientId: linkRecipient.id,
      recipientId: linkRecipient.recipientId,
      emailId: linkRecipient.link.emailId,
      url: linkRecipient.link.url,
      userAgent: params.userAgent ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    return {
      url: linkRecipient.link.url,
      linkRecipient,
      recipient: linkRecipient.recipient,
    };
  }

  const now = new Date();
  const device = parseDevice(params.userAgent);

  const recentEvent = await prisma.messagingEmailEvent.findFirst({
    where: { linkRecipientId: linkRecipient.id, type: "CLICK" },
    orderBy: { occurredAt: "desc" },
  });

  if (recentEvent) {
    const elapsed = now.getTime() - recentEvent.occurredAt.getTime();
    const sameUserAgent =
      (recentEvent.userAgent ?? "") === (params.userAgent ?? "");
    if (elapsed >= 0 && elapsed < CLICK_DEDUP_WINDOW_MS && sameUserAgent) {
      console.log("[email-tracking] duplicate click ignored", {
        linkRecipientId: linkRecipient.id,
        recipientId: linkRecipient.recipientId,
        emailId: linkRecipient.link.emailId,
        elapsedMs: elapsed,
        userAgent: params.userAgent ?? null,
        ipAddress: params.ipAddress ?? null,
      });
      return {
        url: linkRecipient.link.url,
        linkRecipient,
        recipient: linkRecipient.recipient,
      };
    }
  }

  console.log("[email-tracking] record click", {
    linkRecipientId: linkRecipient.id,
    recipientId: linkRecipient.recipientId,
    emailId: linkRecipient.link.emailId,
    url: linkRecipient.link.url,
    userAgent: params.userAgent ?? null,
    deviceFamily: device.deviceFamily,
    deviceType: device.deviceType,
    ipAddress: params.ipAddress ?? null,
  });

  await prisma.$transaction(async (tx) => {
    await tx.messagingEmailLinkRecipient.update({
      where: { id: linkRecipient.id },
      data: {
        clickCount: { increment: 1 },
        firstClickedAt: linkRecipient.firstClickedAt ?? now,
        lastClickedAt: now,
      },
    });

    await tx.messagingEmailRecipient.update({
      where: { id: linkRecipient.recipientId },
      data: {
        clickCount: { increment: 1 },
        lastClickedAt: now,
      },
    });

    await tx.messagingEmailEvent.create({
      data: {
        emailId: linkRecipient.link.emailId,
        recipientId: linkRecipient.recipientId,
        linkId: linkRecipient.linkId,
        linkRecipientId: linkRecipient.id,
        type: "CLICK",
        userAgent: params.userAgent,
        deviceFamily: device.deviceFamily,
        deviceType: device.deviceType,
        occurredAt: now,
      },
    });

    await ensureImplicitOpenFromClick({
      tx,
      recipient: linkRecipient.recipient,
      occurredAt: now,
      device,
      userAgent: params.userAgent,
    });
  });

  return {
    url: linkRecipient.link.url,
    linkRecipient,
    recipient: linkRecipient.recipient,
  };
}

export async function getEmailTrackingSummaries(params: {
  userId: string;
  messageIds: string[];
}): Promise<Map<string, EmailTrackingSummary>> {
  const { userId, messageIds } = params;
  if (!messageIds.length) {
    return new Map();
  }

  const emails = await prisma.messagingEmail.findMany({
    where: {
      userId,
      messageId: { in: messageIds },
    },
    include: {
      recipients: true,
    },
  });

  const summaries = new Map<string, EmailTrackingSummary>();

  for (const email of emails) {
    const recipientsSummaries = email.recipients.map((recipient) => ({
      id: recipient.id,
      address: recipient.address,
      name: recipient.name,
      type: recipient.type,
      openCount: recipient.openCount,
      firstOpenedAt: recipient.firstOpenedAt
        ? recipient.firstOpenedAt.toISOString()
        : null,
      lastOpenedAt: recipient.lastOpenedAt
        ? recipient.lastOpenedAt.toISOString()
        : null,
      clickCount: recipient.clickCount,
      lastClickedAt: recipient.lastClickedAt
        ? recipient.lastClickedAt.toISOString()
        : null,
    }));

    const totalOpens = recipientsSummaries.reduce(
      (acc, recipient) => acc + recipient.openCount,
      0,
    );
    const totalClicks = recipientsSummaries.reduce(
      (acc, recipient) => acc + recipient.clickCount,
      0,
    );

    summaries.set(email.messageId, {
      emailId: email.id,
      messageId: email.messageId,
      trackingEnabled: email.trackingEnabled,
      sentAt: email.sentAt.toISOString(),
      subject: email.subject,
      totalOpens,
      totalClicks,
      recipients: recipientsSummaries,
    });
  }

  return summaries;
}

async function loadEmailTrackingDetail(
  userId: string,
  messageId: string,
): Promise<EmailTrackingDetail | null> {
  const email = await prisma.messagingEmail.findUnique({
    where: {
      userId_messageId: {
        userId,
        messageId,
      },
    },
    include: {
      recipients: {
        include: {
          events: {
            select: {
              id: true,
              type: true,
              userAgent: true,
              deviceFamily: true,
              deviceType: true,
              occurredAt: true,
            },
            orderBy: { occurredAt: "desc" },
          },
        },
      },
      links: {
        include: {
          recipients: {
            select: {
              id: true,
              recipientId: true,
              clickCount: true,
              lastClickedAt: true,
              recipient: {
                select: {
                  id: true,
                  address: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!email) {
    return null;
  }

  const recipientDetails: EmailTrackingRecipientDetail[] =
    email.recipients.map((recipient) => {
      const summary: EmailTrackingRecipientSummary = {
        id: recipient.id,
        address: recipient.address,
        name: recipient.name,
        type: recipient.type,
        openCount: recipient.openCount,
        firstOpenedAt: recipient.firstOpenedAt
          ? recipient.firstOpenedAt.toISOString()
          : null,
        lastOpenedAt: recipient.lastOpenedAt
          ? recipient.lastOpenedAt.toISOString()
          : null,
        clickCount: recipient.clickCount,
        lastClickedAt: recipient.lastClickedAt
          ? recipient.lastClickedAt.toISOString()
          : null,
      };

      const recipientEvents = recipient.events ?? [];
      const deviceMap = new Map<string, EmailTrackingDevice>();
      for (const event of recipientEvents) {
        const key = `${event.deviceFamily ?? "unknown"}::${
          event.deviceType ?? "unknown"
        }`;
        const existing = deviceMap.get(key);
        const candidate = createDeviceSummary(event);
        if (!existing || existing.lastSeenAt < candidate.lastSeenAt) {
          deviceMap.set(key, candidate);
        }
      }

      return {
        ...summary,
        devices: Array.from(deviceMap.values()).sort((a, b) =>
          a.lastSeenAt > b.lastSeenAt ? -1 : 1,
        ),
      };
    });

  const linkDetails: EmailTrackingLinkDetail[] = email.links
    .map((link) => {
      const totalClicks = link.recipients.reduce(
        (acc, entry) => acc + entry.clickCount,
        0,
      );

      const perRecipient = link.recipients
        .map((entry) => ({
          recipientId: entry.recipientId,
          address: entry.recipient?.address ?? "",
          clickCount: entry.clickCount,
          lastClickedAt: entry.lastClickedAt
            ? entry.lastClickedAt.toISOString()
            : null,
        }))
        .sort((a, b) => (b.clickCount ?? 0) - (a.clickCount ?? 0));

      return {
        id: link.id,
        url: link.url,
        position: link.position,
        totalClicks,
        recipients: perRecipient,
      };
    })
    .sort((a, b) => a.position - b.position);

  const totalOpens = recipientDetails.reduce(
    (acc, recipient) => acc + recipient.openCount,
    0,
  );
  const totalClicks = recipientDetails.reduce(
    (acc, recipient) => acc + recipient.clickCount,
    0,
  );

  return {
    emailId: email.id,
    messageId: email.messageId,
    trackingEnabled: email.trackingEnabled,
    sentAt: email.sentAt.toISOString(),
    subject: email.subject,
    totalOpens,
    totalClicks,
    recipients: recipientDetails,
    links: linkDetails,
  };
}

const TRACKING_DETAIL_CACHE_TTL_MS = 30 * 1000;
const trackingDetailCache = new Map<
  string,
  { data: EmailTrackingDetail | null; expiresAt: number }
>();

export async function getEmailTrackingDetail(params: {
  userId: string;
  messageId: string;
}): Promise<EmailTrackingDetail | null> {
  const cacheKey = `${params.userId}::${params.messageId}`;
  const cached = trackingDetailCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const data = await loadEmailTrackingDetail(params.userId, params.messageId);
  trackingDetailCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + TRACKING_DETAIL_CACHE_TTL_MS,
  });
  return data;
}

export const __emailTrackingInternals = {
  buildOpenPixelMarkup,
  shouldSuppressOpenEvent,
  isProxyOpenUserAgent,
  shouldSuppressClickEvent,
  hashFingerprint,
  isSelfOpen,
  injectTrackingIntoHtml,
};
