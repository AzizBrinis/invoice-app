type PathScopedNavigationUpdateOptions = {
  currentHref: string;
  ownedPathname: string | null | undefined;
  nextHref: string;
};

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function canApplyPathScopedNavigationUpdate({
  currentHref,
  ownedPathname,
  nextHref,
}: PathScopedNavigationUpdateOptions) {
  if (!ownedPathname) {
    return false;
  }

  try {
    const currentUrl = new URL(currentHref);
    const nextUrl = new URL(nextHref, currentUrl.origin);
    const normalizedOwnedPathname = normalizePathname(ownedPathname);

    return (
      normalizePathname(currentUrl.pathname) === normalizedOwnedPathname &&
      normalizePathname(nextUrl.pathname) === normalizedOwnedPathname
    );
  } catch {
    return false;
  }
}
