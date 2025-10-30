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

function isSupportedMailbox(value: string | undefined): value is Mailbox {
  return !!value && SUPPORTED_MAILBOXES.has(value as Mailbox);
}

function escapeFilename(value: string): string {
  return value.replace(/"/g, '\\"');
}

async function resolveParams(
  input: RouteParams | Promise<RouteParams> | undefined,
): Promise<RouteParams> {
  if (!input) {
    return {};
  }
  if (typeof (input as Promise<RouteParams>).then === "function") {
    return await (input as Promise<RouteParams>);
  }
  return input as RouteParams;
}

export async function GET(
  request: Request,
  context:
    | { params: RouteParams | Promise<RouteParams> }
    | Promise<{ params: RouteParams | Promise<RouteParams> }>,
) {
  const resolvedContext =
    typeof (context as Promise<{ params: RouteParams }>).then === "function"
      ? await (context as Promise<{ params: RouteParams | Promise<RouteParams> }>)
      : (context as { params: RouteParams | Promise<RouteParams> });

  const params = await resolveParams(resolvedContext?.params);
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
    const safeFilename = escapeFilename(download.filename);
    const headers = new Headers({
      "Content-Type": download.contentType || "application/octet-stream",
      "Content-Length": download.content.length.toString(),
      "Content-Disposition": `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(download.filename)}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    });

    return new NextResponse(download.content, {
      status: 200,
      headers,
    });
  } catch (error) {
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
