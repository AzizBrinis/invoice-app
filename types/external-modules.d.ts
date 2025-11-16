declare module "sanitize-html" {
  interface TransformResult {
    tagName?: string;
    attribs?: Record<string, string>;
  }

  type TransformHandler =
    | string
    | ((
        tagName: string,
        attribs: Record<string, string>,
      ) => TransformResult | string);

  export interface IOptions {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedStyles?: Record<string, Record<string, RegExp[]>>;
    allowedSchemes?: string[];
    disallowedTagsMode?: "discard" | "recursiveEscape";
    selfClosing?: string[];
    transformTags?: Record<string, TransformHandler>;
    parser?: {
      lowerCaseTags?: boolean;
      lowerCaseAttributeNames?: boolean;
    };
  }

  interface SanitizeHtmlStatic {
    (dirty: string, options?: IOptions): string;
    defaults: {
      allowedTags: string[];
      allowedAttributes: Record<string, string[]>;
      allowedSchemes: string[];
    };
    simpleTransform(
      tagName: string,
      attribs: Record<string, string>,
    ): TransformHandler;
  }

  const sanitizeHtml: SanitizeHtmlStatic;
  export default sanitizeHtml;
}

declare module "mailparser" {
  import type { Readable } from "node:stream";

  export interface Attachment {
    checksum?: string | null;
    filename?: string | null;
    contentType?: string | null;
    size?: number | null;
    content?:
      | Buffer
      | Uint8Array
      | string
      | Readable
      | AsyncIterable<Buffer | Uint8Array | string>
      | null;
  }

  export interface AddressObject {
    name?: string | null;
    address?: string | null;
  }

  export interface ParsedMail {
    headers: Map<string, unknown>;
    subject?: string;
    text?: string | null;
    textAsHtml?: string | null;
    html?: string | false | null;
    attachments: Attachment[];
    messageId?: string | null;
    from?: { value: AddressObject[]; text?: string | null };
    to?: { value: AddressObject[]; text?: string | null };
    cc?: { value: AddressObject[]; text?: string | null };
    bcc?: { value: AddressObject[]; text?: string | null };
    replyTo?: { value: AddressObject[]; text?: string | null };
  }

  export function simpleParser(
    source: string | Buffer | Readable,
  ): Promise<ParsedMail>;
}
