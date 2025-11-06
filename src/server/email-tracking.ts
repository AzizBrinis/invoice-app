import { randomUUID } from "node:crypto";
import { load as loadHtml } from "cheerio";
import UAParser from "ua-parser-js";
import type {
  MessagingEmail,
  MessagingEmailEvent,
  MessagingEmailLink,
  MessagingEmailLinkRecipient,
  MessagingEmailRecipient,
  MessagingRecipientType,
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

function injectTrackingIntoHtml(params: {
  html: string;
  openPixelUrl: string | null;
  linkUrls: Map<number, string>;
}): string {
  const { html, openPixelUrl, linkUrls } = params;
  const $ = loadHtml(html);

  if (openPixelUrl) {
    const pixelElement =
      `<img src="${openPixelUrl}" alt="" width="1" height="1" style="display:none;max-height:1px !important;max-width:1px !important;" />`;
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

function createDeviceSummary(event: MessagingEmailEvent): EmailTrackingDevice {
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

export async function prepareEmailTracking(params: {
  userId: string;
  messageId: string;
  subject: string | null;
  sentAt: Date;
  html: string;
  recipients: RecipientInput[];
  trackingEnabled: boolean;
}): Promise<PrepareEmailTrackingResult> {
  const {
    userId,
    messageId,
    subject,
    sentAt,
    html,
    recipients,
    trackingEnabled,
  } = params;

  if (!recipients.length) {
    throw new Error("Aucun destinataire fourni pour l'e-mail à tracer.");
  }

  const baseUrl = trackingEnabled ? getAppBaseUrl() : null;
  const linkDescriptors = trackingEnabled ? extractTrackableLinks(html) : [];

  return await prisma.$transaction(async (tx) => {
    const email = await tx.messagingEmail.create({
      data: {
        userId,
        messageId,
        subject,
        sentAt,
        trackingEnabled,
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
          await tx.messagingEmailLinkRecipient.create({
            data: {
              linkId: linkRecord.id,
              recipientId: recipient.id,
              token,
            },
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
}): Promise<MessagingEmailRecipient | null> {
  const recipient = await prisma.messagingEmailRecipient.findUnique({
    where: { openToken: params.token },
  });
  if (!recipient) {
    return null;
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

export async function getEmailTrackingDetail(params: {
  userId: string;
  messageId: string;
}): Promise<EmailTrackingDetail | null> {
  const { userId, messageId } = params;

  const email = await prisma.messagingEmail.findUnique({
    where: {
      userId_messageId: {
        userId,
        messageId,
      },
    },
    include: {
      recipients: true,
      links: true,
    },
  });

  if (!email) {
    return null;
  }

  const events = await prisma.messagingEmailEvent.findMany({
    where: { emailId: email.id },
    orderBy: { occurredAt: "desc" },
  });

  const linkRecipients = await prisma.messagingEmailLinkRecipient.findMany({
    where: { link: { emailId: email.id } },
    include: {
      link: true,
      recipient: true,
    },
  });

  const eventsByRecipient = new Map<string, MessagingEmailEvent[]>();
  for (const event of events) {
    if (!event.recipientId) continue;
    const bucket = eventsByRecipient.get(event.recipientId) ?? [];
    bucket.push(event);
    eventsByRecipient.set(event.recipientId, bucket);
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

      const recipientEvents = eventsByRecipient.get(recipient.id) ?? [];
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
      const targets = linkRecipients.filter(
        (entry) => entry.linkId === link.id,
      );

      const totalClicks = targets.reduce(
        (acc, entry) => acc + entry.clickCount,
        0,
      );

      const perRecipient = targets
        .map((entry) => ({
          recipientId: entry.recipientId,
          address: entry.recipient.address,
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
