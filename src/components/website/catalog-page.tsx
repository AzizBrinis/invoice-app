import type { CatalogPayload } from "@/server/website";
import { DevAgencyTemplate } from "@/components/website/templates/dev-agency";

type CatalogPageProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
};

const TEMPLATE_COMPONENTS = {
  "dev-agency": DevAgencyTemplate,
} as const;

export function CatalogPage(props: CatalogPageProps) {
  const Template =
    TEMPLATE_COMPONENTS[props.data.website.templateKey] ??
    DevAgencyTemplate;
  return <Template {...props} />;
}
