"use server";

import { revalidatePath } from "next/cache";
import type { WebsiteBuilderConfig } from "@/lib/website/builder";
import type { ContactSocialLink } from "@/lib/website/contact";
import {
  saveWebsiteBuilderConfig,
  saveWebsiteContactPage,
  saveWebsiteEcommerceSettings,
  getWebsiteEcommerceSettings,
  getWebsiteBuilderState,
  resolveContactSocialLinks,
} from "@/server/website";
import { requireAppSectionAccess } from "@/lib/authorization";

async function requireWebsiteAccess() {
  await requireAppSectionAccess("website");
}

export async function persistBuilderConfigAction(
  config: WebsiteBuilderConfig,
) {
  await requireWebsiteAccess();
  const result = await saveWebsiteBuilderConfig(config);
  revalidatePath("/site-web");
  revalidatePath("/preview");
  revalidatePath("/catalogue");
  return result;
}

export async function reloadBuilderStateAction() {
  await requireWebsiteAccess();
  return getWebsiteBuilderState();
}

export async function persistContactPageAction(input: {
  intro: string;
  email: string;
  phone: string;
  address: string;
  socialLinks: ContactSocialLink[];
}) {
  await requireWebsiteAccess();
  const result = await saveWebsiteContactPage({
    contactBlurb: input.intro,
    contactEmailOverride: input.email,
    contactPhoneOverride: input.phone,
    contactAddressOverride: input.address,
    socialLinks: input.socialLinks,
  });
  revalidatePath("/site-web");
  revalidatePath("/preview");
  revalidatePath("/catalogue");
  return {
    intro: result.contactBlurb ?? "",
    email: result.contactEmailOverride ?? "",
    phone: result.contactPhoneOverride ?? "",
    address: result.contactAddressOverride ?? "",
    socialLinks: resolveContactSocialLinks(result.socialLinks ?? []),
  };
}

export async function persistSignupSettingsAction(input: {
  redirectTarget: "home" | "account";
  providers: {
    facebook: {
      enabled: boolean;
      useEnv: boolean;
      clientId: string | null;
      clientSecret: string | null;
    };
    google: {
      enabled: boolean;
      useEnv: boolean;
      clientId: string | null;
      clientSecret: string | null;
    };
    twitter: {
      enabled: boolean;
      useEnv: boolean;
      clientId: string | null;
      clientSecret: string | null;
    };
  };
}) {
  await requireWebsiteAccess();
  const current = await getWebsiteEcommerceSettings(undefined, {
    includeSecrets: true,
  });
  await saveWebsiteEcommerceSettings({
    ...current,
    signup: input,
  });
  revalidatePath("/site-web");
  revalidatePath("/preview");
  revalidatePath("/catalogue");
  return {
    redirectTarget: input.redirectTarget,
    providers: input.providers,
  };
}
