"use server";

import { revalidatePath } from "next/cache";
import type { WebsiteBuilderConfig } from "@/lib/website/builder";
import {
  saveWebsiteBuilderConfig,
  getWebsiteBuilderState,
} from "@/server/website";

export async function persistBuilderConfigAction(
  config: WebsiteBuilderConfig,
) {
  const result = await saveWebsiteBuilderConfig(config);
  revalidatePath("/site-web");
  revalidatePath("/preview");
  revalidatePath("/catalogue");
  return result;
}

export async function reloadBuilderStateAction() {
  return getWebsiteBuilderState();
}
