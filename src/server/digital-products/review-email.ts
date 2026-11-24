import { isAllowedMessagingAttachmentType } from "@/lib/messaging/attachments";
import {
  MAX_REVIEW_ATTACHMENTS,
  REVIEW_ATTACHMENTS_ACCEPT,
  REVIEW_ATTACHMENTS_LIMIT_BYTES,
  REVIEW_ATTACHMENTS_LIMIT_LABEL,
} from "@/lib/digital-products/review-attachments";
import type { ReviewedEmail } from "@/server/digital-products/fulfilment";
import { sanitizeOrderEmailOverride } from "@/server/digital-products/order-email";
import type { EmailAttachment } from "@/server/messaging";

export class ReviewEmailError extends Error {}

/** Types a mail client or browser may execute: never attached, whatever the general rules allow. */
const REFUSED_TYPES = new Set(["image/svg+xml", "text/html", "application/xhtml+xml"]);
/** Same list as the file picker, enforced here: a name the picker would not offer is refused. */
const ALLOWED_EXTENSIONS = new Set(REVIEW_ATTACHMENTS_ACCEPT.split(","));
const extensionOf = (filename: string) => filename.slice(filename.lastIndexOf(".")).toLowerCase();

/** First bytes of the formats that have a fixed signature: the content must be what the name says. */
const SIGNATURES: Record<string, number[][]> = {
  ".pdf": [[0x25, 0x50, 0x44, 0x46]],
  ".png": [[0x89, 0x50, 0x4e, 0x47]],
  ".jpg": [[0xff, 0xd8, 0xff]],
  ".jpeg": [[0xff, 0xd8, 0xff]],
  ".gif": [[0x47, 0x49, 0x46, 0x38]],
  ".webp": [[0x52, 0x49, 0x46, 0x46]],
  ".zip": [[0x50, 0x4b]],
  ".docx": [[0x50, 0x4b]],
  ".xlsx": [[0x50, 0x4b]],
  ".doc": [[0xd0, 0xcf, 0x11, 0xe0]],
  ".xls": [[0xd0, 0xcf, 0x11, 0xe0]],
};

function contentMatchesName(filename: string, content: Buffer) {
  const signatures = SIGNATURES[extensionOf(filename)];
  return !signatures || signatures.some((bytes) => bytes.every((byte, index) => content[index] === byte));
}

/** Plain, header-safe file name (no path, control or bidi characters). */
export function safeAttachmentName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩"<>|:*?]+/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return clean.slice(-120) || "document";
}

/** Review form → what is sent. Only this order's licences can be attached. */
export async function parseReviewedEmail(formData: FormData, orderLicenceIds: readonly string[]): Promise<ReviewedEmail> {
  // Validated here too so that an invalid edit never reaches the order.
  const { subject, html } = sanitizeOrderEmailOverride({
    subject: String(formData.get("subject") ?? ""),
    html: String(formData.get("html") ?? ""),
  });
  const licenceOrderIds = formData.getAll("licence").map(String);
  if (licenceOrderIds.some((id) => !orderLicenceIds.includes(id))) {
    throw new ReviewEmailError("Pièce jointe inconnue pour cette commande.");
  }
  const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_REVIEW_ATTACHMENTS) {
    throw new ReviewEmailError(`${MAX_REVIEW_ATTACHMENTS} fichiers ajoutés au maximum.`);
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > REVIEW_ATTACHMENTS_LIMIT_BYTES) {
    throw new ReviewEmailError(`Les fichiers ajoutés dépassent ${REVIEW_ATTACHMENTS_LIMIT_LABEL} au total.`);
  }
  const extraAttachments: EmailAttachment[] = [];
  for (const file of files) {
    const type = file.type.toLowerCase();
    const filename = safeAttachmentName(file.name);
    if (!type || REFUSED_TYPES.has(type) || !ALLOWED_EXTENSIONS.has(extensionOf(filename)) || !isAllowedMessagingAttachmentType(type)) {
      throw new ReviewEmailError(`Type de fichier non autorisé : ${filename}`);
    }
    const content = Buffer.from(await file.arrayBuffer());
    if (!contentMatchesName(filename, content)) {
      throw new ReviewEmailError(`Le contenu du fichier ne correspond pas à son type : ${filename}`);
    }
    extraAttachments.push({ filename, content, contentType: type });
  }
  return {
    subject,
    html,
    includeInvoice: formData.get("invoice") === "1",
    licenceOrderIds: [...new Set(licenceOrderIds)],
    extraAttachments,
  };
}
