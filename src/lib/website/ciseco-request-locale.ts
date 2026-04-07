import type { NextRequest } from "next/server";
import {
  CISECO_LOCALE_COOKIE_NAME,
  CISECO_LOCALE_QUERY_PARAM,
  resolveCisecoLocale,
  translateCisecoText,
} from "@/components/website/templates/ecommerce-ciseco/locale";

function resolveRefererLocale(request: NextRequest) {
  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    const url = new URL(referer);
    return url.searchParams.get(CISECO_LOCALE_QUERY_PARAM);
  } catch {
    return null;
  }
}

export function resolveCisecoLocaleFromRequest(request: NextRequest) {
  return resolveCisecoLocale(
    request.nextUrl.searchParams.get(CISECO_LOCALE_QUERY_PARAM),
    request.cookies.get(CISECO_LOCALE_COOKIE_NAME)?.value,
    resolveRefererLocale(request),
    request.headers.get("accept-language"),
  );
}

export function createCisecoRequestTranslator(request: NextRequest) {
  const locale = resolveCisecoLocaleFromRequest(request);

  return {
    locale,
    t: (text: string) => translateCisecoText(locale, text),
  };
}
