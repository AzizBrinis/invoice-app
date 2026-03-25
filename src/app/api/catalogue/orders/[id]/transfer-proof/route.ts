import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { getAppHostnames } from "@/lib/env";
import { resolveCatalogWebsite } from "@/server/website";
import { attachOrderTransferProof } from "@/server/orders";

const APP_HOSTS = new Set(getAppHostnames());
const MAX_PROOF_FILE_SIZE = 6 * 1024 * 1024;
const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || "order-proofs";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const ALLOWED_PROOF_MIME_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

function getStorageConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Stockage des preuves non configuré.");
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
  proof: File;
  extension: string;
}) {
  const config = getStorageConfig();
  const fileName = buildProofFileName(options.extension);
  const storagePath = buildProofStoragePath(
    options.userId,
    options.orderId,
    fileName,
  );
  const uploadUrl = `${config.baseUrl}/storage/v1/object/${config.bucket}/${storagePath}`;
  const arrayBuffer = await options.proof.arrayBuffer();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.serviceKey}`,
      "content-type": options.proof.type,
      "x-upsert": "false",
    },
    body: Buffer.from(arrayBuffer),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Impossible de stocker la preuve. ${errorBody || "Erreur inconnue."}`,
    );
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const orderId = params.id;
    if (!orderId || orderId.includes("/") || orderId.includes("..")) {
      throw new Error("Commande invalide.");
    }

    const formData = await request.formData();
    const modeValue = normalizeStringEntry(formData.get("mode"));
    const mode = modeValue === "preview" ? "preview" : "public";
    const slug = normalizeStringEntry(formData.get("slug"));

    const host = request.headers.get("host")?.toLowerCase() ?? "";
    const domain = APP_HOSTS.has(host) ? null : host;
    const website = await resolveCatalogWebsite({
      slug,
      domain,
      preview: mode === "preview",
    });
    if (!website) {
      throw new Error("Site introuvable.");
    }

    if (mode === "preview") {
      return NextResponse.json({
        status: "preview-only",
        message:
          "Mode previsualisation : aucun fichier n'a ete enregistre.",
      });
    }

    const proof = formData.get("proof");
    if (!(proof instanceof File) || proof.size === 0) {
      throw new Error("Fichier de preuve invalide.");
    }
    if (proof.size > MAX_PROOF_FILE_SIZE) {
      throw new Error("La preuve depasse la taille maximale de 6 Mo.");
    }
    const extension = ALLOWED_PROOF_MIME_TYPES.get(proof.type);
    if (!extension) {
      throw new Error(
        "Format de preuve non supporte. Utilisez PNG, JPG, WEBP ou PDF.",
      );
    }

    const { proofUrl } = await uploadProofToSupabase({
      userId: website.userId,
      orderId,
      proof,
      extension,
    });
    const result = await attachOrderTransferProof(
      {
        orderId,
        proofUrl,
        proofMimeType: proof.type,
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
      error instanceof Error
        ? error.message
        : "Impossible d'enregistrer la preuve.";
    return NextResponse.json(
      { error: message },
      {
        status: 400,
      },
    );
  }
}
