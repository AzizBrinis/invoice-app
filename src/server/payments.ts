import { createHmac, timingSafeEqual } from "crypto";
import { Prisma, OrderPaymentStatus } from "@/lib/db/prisma-server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateId } from "@/lib/id";
import { syncOrderPaymentStatus } from "@/server/orders";

const PAYMENT_PROVIDER_KEYS = ["stub", "stripe"] as const;
type PaymentProviderKey = (typeof PAYMENT_PROVIDER_KEYS)[number];
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

const PAYMENT_STATUS_VALUES = [
  "pending",
  "authorized",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
] as const;
type PaymentEventStatus = (typeof PAYMENT_STATUS_VALUES)[number];

type ProviderCheckoutSessionInput = {
  paymentId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, unknown> | null;
};

type ProviderCheckoutSession = {
  reference: string;
  checkoutUrl: string | null;
};

type WebhookEvent = {
  provider: PaymentProviderKey;
  orderId: string | null;
  paymentId: string | null;
  externalReference: string | null;
  status: PaymentEventStatus;
  amountCents: number | null;
  currency: string | null;
  method: string | null;
  metadata: Record<string, unknown> | null;
};

type PaymentProvider = {
  key: PaymentProviderKey;
  createCheckoutSession: (
    input: ProviderCheckoutSessionInput,
  ) => Promise<ProviderCheckoutSession>;
  parseWebhookEvent: (
    payload: unknown,
    signature: string | null,
    rawBody: string,
  ) => Promise<WebhookEvent | null>;
};

const createCheckoutSessionSchema = z.object({
  orderId: z.string().min(1),
  provider: z.enum(PAYMENT_PROVIDER_KEYS).optional(),
  method: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  successUrl: z.string().url().max(400),
  cancelUrl: z.string().url().max(400),
});

const numericSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
  },
  z.number().int().nonnegative(),
);

const stubWebhookSchema = z.object({
  provider: z.literal("stub").default("stub"),
  orderId: z.string().min(1).nullable().optional(),
  paymentId: z.string().min(1).nullable().optional(),
  externalReference: z.string().min(1).nullable().optional(),
  status: z.enum(PAYMENT_STATUS_VALUES),
  amountCents: numericSchema.nullable().optional(),
  currency: z.string().min(1).nullable().optional(),
  method: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const stripeEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

const stripeCheckoutSessionSchema = z.object({
  id: z.string().min(1),
  object: z.literal("checkout.session"),
  payment_status: z.string().nullable().optional(),
  amount_total: numericSchema.nullable().optional(),
  currency: z.string().nullable().optional(),
  client_reference_id: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const stripePaymentIntentSchema = z.object({
  id: z.string().min(1),
  object: z.literal("payment_intent"),
  status: z.string().nullable().optional(),
  amount_received: numericSchema.nullable().optional(),
  currency: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const stubProvider: PaymentProvider = {
  key: "stub",
  async createCheckoutSession() {
    assertStubPaymentsEnabled();
    return {
      reference: generateId("pay"),
      checkoutUrl: null,
    };
  },
  async parseWebhookEvent(payload) {
    assertStubPaymentsEnabled();
    const parsed = stubWebhookSchema.parse(payload);
    return {
      provider: parsed.provider,
      orderId: parsed.orderId ?? null,
      paymentId: parsed.paymentId ?? null,
      externalReference: parsed.externalReference ?? null,
      status: parsed.status,
      amountCents: parsed.amountCents ?? null,
      currency: parsed.currency ?? null,
      method: parsed.method ?? null,
      metadata: parsed.metadata ?? null,
    };
  },
};

function getEnvValue(key: string) {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : null;
}

function getStripeSecretKey() {
  return getEnvValue("STRIPE_SECRET_KEY");
}

function getStripeWebhookSecret() {
  return getEnvValue("STRIPE_WEBHOOK_SECRET");
}

function allowStubPayments() {
  return (
    process.env.NODE_ENV !== "production" ||
    getEnvValue("ALLOW_STUB_PAYMENTS") === "1"
  );
}

function assertStubPaymentsEnabled() {
  if (!allowStubPayments()) {
    throw new Error(
      "Stub payments are disabled. Configure a real payment provider before accepting card payments.",
    );
  }
}

function normalizeStripeMetadataValue(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStripeMetadata(
  value: Record<string, unknown> | null,
): Record<string, string> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      typeof entry === "string" ? entry : JSON.stringify(entry),
    ]),
  );
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  let timestamp: string | null = null;
  const signatures: string[] = [];
  parts.forEach((part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return;
    if (key === "t") {
      timestamp = value;
    }
    if (key === "v1") {
      signatures.push(value);
    }
  });
  if (!timestamp || signatures.length === 0) {
    throw new Error("Signature Stripe invalide.");
  }
  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) >
      STRIPE_WEBHOOK_TOLERANCE_SECONDS
  ) {
    throw new Error("Signature Stripe expirée.");
  }
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  if (!signatures.some((signature) => safeEqual(signature, expected))) {
    throw new Error("Signature Stripe invalide.");
  }
}

function mapStripeCheckoutStatus(
  eventType: string,
  paymentStatus?: string | null,
): PaymentEventStatus {
  if (eventType === "checkout.session.async_payment_succeeded") {
    return "succeeded";
  }
  if (eventType === "checkout.session.async_payment_failed") {
    return "failed";
  }
  if (eventType === "checkout.session.expired") {
    return "cancelled";
  }
  if (paymentStatus === "paid" || paymentStatus === "no_payment_required") {
    return "succeeded";
  }
  return "pending";
}

function mapStripePaymentIntentStatus(
  eventType: string,
  intentStatus?: string | null,
): PaymentEventStatus {
  if (eventType === "payment_intent.succeeded" || intentStatus === "succeeded") {
    return "succeeded";
  }
  if (
    eventType === "payment_intent.payment_failed" ||
    intentStatus === "requires_payment_method"
  ) {
    return "failed";
  }
  if (eventType === "payment_intent.canceled" || intentStatus === "canceled") {
    return "cancelled";
  }
  if (intentStatus === "requires_capture") {
    return "authorized";
  }
  return "pending";
}

const stripeProvider: PaymentProvider = {
  key: "stripe",
  async createCheckoutSession(input) {
    const secretKey = getStripeSecretKey();
    if (!secretKey) {
      throw new Error("Stripe n'est pas configuré.");
    }
    const metadata = toStripeMetadata({
      ...(input.metadata ?? {}),
      orderId: input.orderId,
      paymentId: input.paymentId,
    });
    const payload = new URLSearchParams();
    payload.set("mode", "payment");
    payload.set("success_url", input.successUrl);
    payload.set("cancel_url", input.cancelUrl);
    payload.set("client_reference_id", input.orderId);
    payload.set("payment_method_types[0]", "card");
    payload.set("line_items[0][quantity]", "1");
    payload.set(
      "line_items[0][price_data][currency]",
      input.currency.toLowerCase(),
    );
    payload.set(
      "line_items[0][price_data][unit_amount]",
      String(input.amountCents),
    );
    payload.set(
      "line_items[0][price_data][product_data][name]",
      `Commande ${input.orderId}`,
    );
    if (input.customerEmail) {
      payload.set("customer_email", input.customerEmail);
    }
    Object.entries(metadata).forEach(([key, value]) => {
      payload.set(`metadata[${key}]`, value);
      payload.set(`payment_intent_data[metadata][${key}]`, value);
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Stripe indisponible (statut ${response.status}). ${errorBody}`,
      );
    }

    const session = (await response.json()) as {
      id?: string;
      url?: string | null;
    };
    if (!session.id) {
      throw new Error("Réponse Stripe invalide.");
    }
    return {
      reference: session.id,
      checkoutUrl: session.url ?? null,
    };
  },
  async parseWebhookEvent(payload, signature, rawBody) {
    if (!signature) {
      throw new Error("Signature Stripe manquante.");
    }
    const webhookSecret = getStripeWebhookSecret();
    if (!webhookSecret) {
      throw new Error("Stripe webhook non configuré.");
    }
    verifyStripeSignature(rawBody, signature, webhookSecret);

    const parsedEvent = stripeEventSchema.parse(payload);
    const objectType =
      typeof parsedEvent.data.object?.object === "string"
        ? String(parsedEvent.data.object.object)
        : null;
    if (objectType === "checkout.session") {
      const session = stripeCheckoutSessionSchema.parse(parsedEvent.data.object);
      const metadata = session.metadata ?? {};
      const orderId =
        normalizeStripeMetadataValue(metadata.orderId) ??
        normalizeStripeMetadataValue(session.client_reference_id);
      const paymentId = normalizeStripeMetadataValue(metadata.paymentId);
      return {
        provider: "stripe",
        orderId,
        paymentId,
        externalReference: session.id,
        status: mapStripeCheckoutStatus(
          parsedEvent.type,
          session.payment_status,
        ),
        amountCents: session.amount_total ?? null,
        currency: session.currency?.toUpperCase() ?? null,
        method: "card",
        metadata,
      };
    }
    if (objectType === "payment_intent") {
      const intent = stripePaymentIntentSchema.parse(parsedEvent.data.object);
      const metadata = intent.metadata ?? {};
      const orderId = normalizeStripeMetadataValue(metadata.orderId);
      const paymentId = normalizeStripeMetadataValue(metadata.paymentId);
      return {
        provider: "stripe",
        orderId,
        paymentId,
        externalReference: intent.id,
        status: mapStripePaymentIntentStatus(parsedEvent.type, intent.status),
        amountCents: intent.amount_received ?? null,
        currency: intent.currency?.toUpperCase() ?? null,
        method: "card",
        metadata,
      };
    }
    return null;
  },
};

const PROVIDERS: Record<PaymentProviderKey, PaymentProvider> = {
  stub: stubProvider,
  stripe: stripeProvider,
};

function resolveProviderKey(key?: PaymentProviderKey): PaymentProviderKey {
  if (key) return key;
  const envKey = getEnvValue("PAYMENT_PROVIDER")?.toLowerCase();
  if (envKey && PAYMENT_PROVIDER_KEYS.includes(envKey as PaymentProviderKey)) {
    return envKey as PaymentProviderKey;
  }
  return "stub";
}

function getProvider(key?: PaymentProviderKey) {
  return PROVIDERS[resolveProviderKey(key)];
}

function toJsonInput(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;

export type CheckoutSessionResult = {
  provider: PaymentProviderKey;
  paymentId: string;
  externalReference: string | null;
  checkoutUrl: string | null;
};

export type WebhookResult = {
  status: "ignored" | "processed";
  orderId?: string;
  paymentId?: string;
};

export function mapStatus(status: PaymentEventStatus) {
  switch (status) {
    case "authorized":
      return OrderPaymentStatus.AUTHORIZED;
    case "succeeded":
      return OrderPaymentStatus.SUCCEEDED;
    case "failed":
      return OrderPaymentStatus.FAILED;
    case "cancelled":
      return OrderPaymentStatus.CANCELLED;
    case "refunded":
      return OrderPaymentStatus.REFUNDED;
    case "pending":
    default:
      return OrderPaymentStatus.PENDING;
  }
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
  providedUserId?: string,
): Promise<CheckoutSessionResult> {
  const payload = createCheckoutSessionSchema.parse(input);
  const userId = providedUserId ?? (await requireUser()).id;
  const provider = getProvider(payload.provider);
  if (provider.key === "stub") {
    assertStubPaymentsEnabled();
  }

  const order = await prisma.order.findFirst({
    where: { id: payload.orderId, userId },
    select: {
      id: true,
      currency: true,
      totalTTCCents: true,
      customerName: true,
      customerEmail: true,
    },
  });
  if (!order) {
    throw new Error("Commande introuvable");
  }

  const payment = await prisma.orderPayment.create({
    data: {
      orderId: order.id,
      userId,
      status: OrderPaymentStatus.PENDING,
      amountCents: order.totalTTCCents,
      currency: order.currency,
      method: payload.method ?? null,
      provider: provider.key,
      metadata: toJsonInput(payload.metadata),
    },
  });

  const session = await provider.createCheckoutSession({
    paymentId: payment.id,
    orderId: order.id,
    amountCents: order.totalTTCCents,
    currency: order.currency,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    successUrl: payload.successUrl,
    cancelUrl: payload.cancelUrl,
    metadata: payload.metadata ?? null,
  });

  const externalReference = session.reference ?? null;
  if (externalReference) {
    await prisma.orderPayment.update({
      where: { id: payment.id },
      data: { externalReference },
    });
  }

  await syncOrderPaymentStatus(order.id, userId);

  return {
    provider: provider.key,
    paymentId: payment.id,
    externalReference,
    checkoutUrl: session.checkoutUrl ?? null,
  };
}

function detectProvider(
  payload: unknown,
  stripeSignature: string | null,
): PaymentProviderKey {
  if (stripeSignature) {
    return "stripe";
  }
  if (payload && typeof payload === "object") {
    if ("provider" in payload) {
      const provider = (payload as { provider?: string }).provider;
      if (
        provider &&
        PAYMENT_PROVIDER_KEYS.includes(provider as PaymentProviderKey)
      ) {
        return provider as PaymentProviderKey;
      }
    }
    if ("type" in payload && "data" in payload) {
      return "stripe";
    }
  }
  return "stub";
}

async function parseWebhookPayload(request: Request) {
  const rawBody = await request.text();
  if (!rawBody) {
    return null;
  }

  try {
    const payload = JSON.parse(rawBody) as unknown;
    return { payload, rawBody };
  } catch {
    const params = new URLSearchParams(rawBody);
    if (Array.from(params.keys()).length === 0) {
      throw new Error("Payload invalide.");
    }
    const payload: Record<string, string> = {};
    params.forEach((value, key) => {
      payload[key] = value;
    });
    return { payload, rawBody };
  }
}

async function applyWebhookEvent(event: WebhookEvent) {
  const paymentStatus = mapStatus(event.status);

  const { orderId, userId, paymentId } = await prisma.$transaction(
    async (tx) => {
      let payment = null;

      if (event.paymentId) {
        payment = await tx.orderPayment.findFirst({
          where: { id: event.paymentId },
        });
      }

      if (!payment && event.externalReference) {
        payment = await tx.orderPayment.findFirst({
          where: {
            externalReference: event.externalReference,
            provider: event.provider,
          },
        });
      }

      const resolvedOrderId = event.orderId ?? payment?.orderId ?? null;
      if (!resolvedOrderId) {
        throw new Error("Commande introuvable");
      }
      if (payment && event.orderId && payment.orderId !== event.orderId) {
        throw new Error("Incohérence entre le paiement et la commande.");
      }

      const order = await tx.order.findFirst({
        where: { id: resolvedOrderId },
        select: {
          id: true,
          userId: true,
          currency: true,
          totalTTCCents: true,
        },
      });
      if (!order) {
        throw new Error("Commande introuvable");
      }

      if (!payment) {
        payment = await tx.orderPayment.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            status: paymentStatus,
            amountCents: event.amountCents ?? order.totalTTCCents,
            currency: event.currency ?? order.currency,
            method: event.method ?? null,
            provider: event.provider,
            externalReference: event.externalReference ?? null,
            metadata: toJsonInput(event.metadata),
            paidAt:
              paymentStatus === OrderPaymentStatus.SUCCEEDED
                ? new Date()
                : null,
          },
        });
      } else {
        const nextStatus =
          payment.status === OrderPaymentStatus.REFUNDED
            ? OrderPaymentStatus.REFUNDED
            : payment.status === OrderPaymentStatus.SUCCEEDED &&
                paymentStatus !== OrderPaymentStatus.REFUNDED
              ? OrderPaymentStatus.SUCCEEDED
              : payment.status === OrderPaymentStatus.AUTHORIZED &&
                  paymentStatus === OrderPaymentStatus.PENDING
                ? OrderPaymentStatus.AUTHORIZED
                : paymentStatus;
        payment = await tx.orderPayment.update({
          where: { id: payment.id },
          data: {
            status: nextStatus,
            amountCents: event.amountCents ?? payment.amountCents,
            currency: event.currency ?? payment.currency,
            method: event.method ?? payment.method ?? null,
            provider: payment.provider ?? event.provider,
            externalReference:
              event.externalReference ?? payment.externalReference ?? null,
            metadata: event.metadata ? toJsonInput(event.metadata) : undefined,
            paidAt:
              nextStatus === OrderPaymentStatus.SUCCEEDED
                ? payment.paidAt ?? new Date()
                : payment.paidAt,
          },
        });
      }

      return {
        orderId: order.id,
        userId: order.userId,
        paymentId: payment.id,
      };
    },
  );

  await syncOrderPaymentStatus(orderId, userId);

  return { orderId, paymentId };
}

export async function handleWebhook(request: Request): Promise<WebhookResult> {
  const parsed = await parseWebhookPayload(request);
  if (!parsed) {
    return { status: "ignored" };
  }

  const stripeSignature = request.headers.get("stripe-signature");
  const signature =
    stripeSignature ?? request.headers.get("x-payment-signature");
  const provider = getProvider(
    detectProvider(parsed.payload, stripeSignature),
  );
  const event = await provider.parseWebhookEvent(
    parsed.payload,
    signature,
    parsed.rawBody,
  );
  if (!event) {
    return { status: "ignored" };
  }

  const { orderId, paymentId } = await applyWebhookEvent(event);
  return { status: "processed", orderId, paymentId };
}
