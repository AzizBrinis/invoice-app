import { NextResponse, type NextRequest } from "next/server";
import { extractSignedToken } from "@/lib/session-cookie";

const PUBLIC_PATHS = ["/connexion", "/inscription", "/api/public"];
const AUTH_COOKIE =
  process.env.SESSION_COOKIE_NAME ?? "session_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/webhooks")
  ) {
    return NextResponse.next();
  }

  const rawCookie = request.cookies.get(AUTH_COOKIE)?.value ?? null;
  const sessionToken = await extractSignedToken(rawCookie);
  const hasSession = Boolean(sessionToken);

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    if ((pathname === "/connexion" || pathname === "/inscription") && hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/tableau-de-bord";
      url.search = "";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/connexion";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
