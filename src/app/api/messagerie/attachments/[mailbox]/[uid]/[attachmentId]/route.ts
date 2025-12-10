import { NextResponse } from "next/server";
import {
  fetchMessageAttachment,
  type Mailbox,
} from "@/server/messaging";

const SUPPORTED_MAILBOXES = new Set<Mailbox>(["inbox", "sent"]);

type RouteParams = {
  mailbox?: string;
  uid?: string;
  attachmentId?: string;
};
type RouteContext = { params: Promise<RouteParams> };

function isSupportedMailbox(value: string | undefined): value is Mailbox {
  return !!value && SUPPORTED_MAILBOXES.has(value as Mailbox);
}

function escapeFilename(value: string): string {
  return value.replace(/"/g, '\\"');
}

function toAsciiSafeValue(value: string): string {
  const ascii = value.replace(/[\u007F-\uFFFF]/g, "?");
  return ascii.replace(/[^\x20-\x7E]/g, "?");
}

export async function GET(
  request: Request,
  context: RouteContext,
) {
  let params: RouteParams = {};
  try {
    params = (await context.params) ?? {};
  } catch (error) {
    console.warn("[attachments] unable to resolve params", error);
  }
  const { mailbox, uid, attachmentId } = params;
  if (!isSupportedMailbox(mailbox)) {
    return NextResponse.json(
      { error: "Boîte aux lettres invalide." },
      { status: 400 },
    );
  }

  const parsedUid = Number.parseInt(uid ?? "", 10);
  if (!Number.isInteger(parsedUid) || parsedUid <= 0) {
    return NextResponse.json(
      { error: "Identifiant de message invalide." },
      { status: 400 },
    );
  }

  if (!attachmentId) {
    return NextResponse.json(
      { error: "Identifiant de pièce jointe manquant." },
      { status: 400 },
    );
  }

  const decodedAttachmentId = decodeURIComponent(attachmentId);
  const url = new URL(request.url);
  const inline = url.searchParams.get("inline") === "1";

  try {
    const download = await fetchMessageAttachment({
      mailbox,
      uid: parsedUid,
      attachmentId: decodedAttachmentId,
    });

    const disposition = inline ? "inline" : "attachment";
    const safeFilename = escapeFilename(
      toAsciiSafeValue(download.filename),
    );
    const headers = new Headers({
      "Content-Type": download.contentType || "application/octet-stream",
      "Content-Length": download.content.byteLength.toString(),
      "Content-Disposition": `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(download.filename)}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    });

    const source = download.content as Uint8Array;
    const arrayBuffer = (source.buffer as ArrayBuffer).slice(
      source.byteOffset,
      source.byteOffset + source.byteLength,
    );

    return new Response(arrayBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[attachments] download failed", {
      mailbox,
      uid: parsedUid,
      attachmentId: decodedAttachmentId,
      error,
    });
    const message = error instanceof Error ? error.message : String(error);
    const notFound = /introuvable/i.test(message);
    return NextResponse.json(
      {
        error: notFound
          ? "Pièce jointe introuvable."
          : "Erreur interne du serveur.",
      },
      { status: notFound ? 404 : 500 },
    );
  }
}
