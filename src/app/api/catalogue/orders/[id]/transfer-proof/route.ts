import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { parseConfirmationToken } from "@/lib/confirmation-token";
import { resolveCatalogDomainFromHeaders } from "@/lib/catalog-host";
import {
  assertSameOriginMutationRequest,
  buildPublicRateLimitKey,
  enforceRateLimit,
  resolveSecurityErrorResponseInit,
} from "@/lib/security/public-request";
import { createCisecoRequestTranslator } from "@/lib/website/ciseco-request-locale";
import { resolveCatalogWebsite } from "@/server/website";
import { attachOrderTransferProof } from "@/server/orders";

const MAX_PROOF_FILE_SIZE = 6 * 1024 * 1024;
const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || "order-proofs";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
type ProofFileType = {
  extension: "jpg" | "pdf" | "png" | "webp";
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
};

function getStorageConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Proof storage is not configured.");
  }
  return {
    baseUrl: SUPABASE_URL.replace(/\/+$/, ""),
    bucket: STORAGE_BUCKET,
    serviceKey: SUPABASE_SERVICE_ROLE_KEY,
  };
}

function buildProofFileName(extension: string) {
  return `${Date.now()}-${randomUUID()}.${extension}`;
}

function buildProofStoragePath(
  userId: string,
  orderId: string,
  fileName: string,
) {
  return `orders/${userId}/${orderId}/${fileName}`;
}

function buildSupabasePublicUrl(
  baseUrl: string,
  bucket: string,
  path: string,
) {
  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

async function uploadProofToSupabase(options: {
  userId: string;
  orderId: string;
  buffer: Buffer;
  contentType: ProofFileType["mimeType"];
  extension: ProofFileType["extension"];
}) {
  const config = getStorageConfig();
  const fileName = buildProofFileName(options.extension);
  const storagePath = buildProofStoragePath(
    options.userId,
    options.orderId,
    fileName,
  );
  const uploadUrl = `${config.baseUrl}/storage/v1/object/${config.bucket}/${storagePath}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.serviceKey}`,
      "content-type": options.contentType,
      "x-upsert": "false",
    },
    body: new Uint8Array(options.buffer),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Unable to store the proof. Unknown error.");
  }

  return {
    proofUrl: buildSupabasePublicUrl(
      config.baseUrl,
      config.bucket,
      storagePath,
    ),
  };
}

function normalizeStringEntry(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function sniffProofFileType(buffer: Buffer): ProofFileType | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return {
      extension: "png",
      mimeType: "image/png",
    };
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      extension: "jpg",
      mimeType: "image/jpeg",
    };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return {
      extension: "webp",
      mimeType: "image/webp",
    };
  }

  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return {
      extension: "pdf",
      mimeType: "application/pdf",
    };
  }

  return null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { t } = createCisecoRequestTranslator(request);
  try {
    assertSameOriginMutationRequest(request.headers, "Invalid request origin.");
    const params = await context.params;
    const orderId = params.id;
    if (!orderId || orderId.includes("/") || orderId.includes("..")) {
      throw new Error("Invalid order.");
    }

    const formData = await request.formData();
    const modeValue = normalizeStringEntry(formData.get("mode"));
    const mode = modeValue === "preview" ? "preview" : "public";
    const domain = resolveCatalogDomainFromHeaders(request.headers);
    const slug = domain ? null : normalizeStringEntry(formData.get("slug"));
    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: mode === "preview",
    });
    if (!website) {
      throw new Error("Site unavailable.");
    }

    if (mode === "preview") {
      return NextResponse.json({
        status: "preview-only",
        message: t("Preview mode: no proof file was saved."),
      });
    }

    const token = normalizeStringEntry(formData.get("token"));
    const tokenPayload = await parseConfirmationToken(token, {
      orderId,
    });
    if (!tokenPayload) {
      throw new Error("Invalid confirmation.");
    }

    enforceRateLimit({
      key: buildPublicRateLimitKey({
        scope: "catalogue-transfer-proof",
        headers: request.headers,
        parts: [orderId],
      }),
      limit: 5,
      windowMs: 15 * 60 * 1000,
      message: "Too many proof uploads. Please wait before trying again.",
    });

    const proof = formData.get("proof");
    if (!(proof instanceof File) || proof.size === 0) {
      throw new Error("Invalid proof file.");
    }
    if (proof.size > MAX_PROOF_FILE_SIZE) {
      throw new Error("The proof exceeds the 6 MB limit.");
    }

    const proofBuffer = Buffer.from(await proof.arrayBuffer());
    const detectedFileType = sniffProofFileType(proofBuffer);
    if (!detectedFileType) {
      throw new Error(
        "Unsupported proof format. Use PNG, JPG, WEBP, or PDF.",
      );
    }

    const { proofUrl } = await uploadProofToSupabase({
      userId: website.userId,
      orderId,
      buffer: proofBuffer,
      contentType: detectedFileType.mimeType,
      extension: detectedFileType.extension,
    });
    const result = await attachOrderTransferProof(
      {
        orderId,
        proofUrl,
        proofMimeType: detectedFileType.mimeType,
        proofSizeBytes: proof.size,
      },
      website.userId,
    );

    return NextResponse.json({
      status: "uploaded",
      orderId: result.orderId,
      paymentId: result.paymentId,
      proofUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? t(error.message) : t("Unable to save the proof.");
    const init = resolveSecurityErrorResponseInit(error, 400);
    return NextResponse.json({ error: message }, init);
  }
}
