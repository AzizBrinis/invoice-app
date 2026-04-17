"use server";

import { Buffer } from "node:buffer";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { isRedirectError } from "@/lib/next";
import { requireAppSectionAccess } from "@/lib/authorization";
import {
  createSiteBlogPost,
  deleteSiteBlogPost,
  updateSiteBlogPost,
  type SiteBlogPostInput,
  type SiteBlogPostStatus,
} from "@/server/site-blog-posts";

const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_IMAGE_FILE_SIZE_BYTES = 3 * 1024 * 1024;

function resolveRedirectTarget(formData: FormData | undefined, fallback: string) {
  const redirectTo = formData?.get("redirectTo")?.toString();
  if (redirectTo && redirectTo.startsWith("/")) {
    return redirectTo;
  }
  return fallback;
}

function redirectWithFeedback(
  target: string,
  feedback: { message?: string; error?: string },
): never {
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  params.delete("message");
  params.delete("error");
  if (feedback.message) params.set("message", feedback.message);
  if (feedback.error) params.set("error", feedback.error);
  const nextQuery = params.toString();
  return redirect((nextQuery ? `${path}?${nextQuery}` : path) as Route);
}

async function requireWebsiteAccess() {
  await requireAppSectionAccess("website");
}

function formText(formData: FormData, key: string) {
  return formData.get(key)?.toString() ?? "";
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function formBoolean(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().toLowerCase();
  return value === "true" || value === "on" || value === "1";
}

function parseTagList(value: string) {
  const seen = new Set<string>();
  const tags: string[] = [];
  value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const key = entry.toLocaleLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      tags.push(entry);
    });
  return tags;
}

async function imageFileToDataUrl(entry: FormDataEntryValue | null) {
  if (!entry || !(entry instanceof File) || entry.size === 0) {
    return null;
  }
  if (!ACCEPTED_IMAGE_MIME_TYPES.has(entry.type)) {
    throw new Error(
      "Format d'image non supporté. Utilisez PNG, JPG, WebP, AVIF ou GIF.",
    );
  }
  if (entry.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new Error("L'image dépasse la taille maximale de 3 Mo.");
  }
  const arrayBuffer = await entry.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:${entry.type};base64,${buffer.toString("base64")}`;
}

async function readBlogPostInput(formData: FormData): Promise<SiteBlogPostInput> {
  const uploadedCoverImage = await imageFileToDataUrl(formData.get("coverImageFile"));
  return {
    title: formText(formData, "title"),
    slug: formText(formData, "slug"),
    excerpt: formText(formData, "excerpt"),
    bodyHtml: formText(formData, "bodyHtml"),
    coverImageUrl:
      uploadedCoverImage ??
      normalizeNullableText(formText(formData, "coverImageUrl")) ??
      undefined,
    socialImageUrl:
      normalizeNullableText(formText(formData, "socialImageUrl")) ?? undefined,
    category: formText(formData, "category"),
    tags: parseTagList(formText(formData, "tags")),
    authorName: formText(formData, "authorName"),
    status: formText(formData, "status") as SiteBlogPostStatus,
    publishDate: normalizeNullableText(formText(formData, "publishDate")),
    featured: formBoolean(formData, "featured"),
    metaTitle: formText(formData, "metaTitle"),
    metaDescription: formText(formData, "metaDescription"),
  };
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Impossible de traiter l'article de blog.";
}

export async function createSiteBlogPostAction(formData: FormData) {
  try {
    await requireWebsiteAccess();
    const created = await createSiteBlogPost(await readBlogPostInput(formData));
    const redirectTarget = created?.id
      ? `/site-web/blogs/${created.id}`
      : "/site-web/blogs";
    redirectWithFeedback(redirectTarget, {
      message: "Article créé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createSiteBlogPostAction] Unable to create blog post", error);
    redirectWithFeedback("/site-web/blogs/nouveau", {
      error: resolveErrorMessage(error),
    });
  }
}

export async function updateSiteBlogPostAction(id: string, formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, `/site-web/blogs/${id}`);
  try {
    await requireWebsiteAccess();
    await updateSiteBlogPost(id, await readBlogPostInput(formData));
    redirectWithFeedback(redirectTarget, {
      message: "Article mis à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updateSiteBlogPostAction] Unable to update blog post", error);
    redirectWithFeedback(redirectTarget, {
      error: resolveErrorMessage(error),
    });
  }
}

export async function deleteSiteBlogPostAction(id: string, formData?: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/site-web/blogs");
  try {
    await requireWebsiteAccess();
    await deleteSiteBlogPost(id);
    redirectWithFeedback("/site-web/blogs", {
      message: "Article supprimé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteSiteBlogPostAction] Unable to delete blog post", error);
    redirectWithFeedback(redirectTarget, {
      error: resolveErrorMessage(error),
    });
  }
}
