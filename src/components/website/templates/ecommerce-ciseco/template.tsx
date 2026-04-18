import { CisecoHomeRouteClient } from "./home-route-client";
import type { TemplateProps } from "./template-shared";
import { normalizePath, resolvePage } from "./utils";

export async function EcommerceCisecoHomeTemplate(props: TemplateProps) {
  const currentPath = normalizePath(props.path);
  const page = resolvePage(currentPath, {
    cmsPaths: props.data.website.cmsPages.map((entry) => entry.path),
  });

  if (page.page === "home" || page.page === "not-found") {
    return <CisecoHomeRouteClient {...props} />;
  }

  const { EcommerceCisecoHomeTemplateClient } = await import("./template-client");
  return <EcommerceCisecoHomeTemplateClient {...props} />;
}
