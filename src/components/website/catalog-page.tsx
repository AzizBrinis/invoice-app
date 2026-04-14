import type { CatalogPayload } from "@/server/website";
import { DevAgencyTemplate } from "@/components/website/templates/dev-agency";
import { EcommerceTemplate } from "@/components/website/templates/ecommerce";
import { EcommerceTechAgencyTemplate } from "@/components/website/templates/ecommerce-tech-agency";
import { EcommerceCescoTemplate } from "@/components/website/templates/ecommerce-cesco";
import { EcommerceCisecoHomeTemplate } from "@/components/website/templates/ecommerce-ciseco-home";
import type { CisecoLocale } from "@/components/website/templates/ecommerce-ciseco/locale";

type CatalogPageProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
  initialLocale?: CisecoLocale;
  resolvedByDomain?: boolean;
};

const TEMPLATE_COMPONENTS = {
  "dev-agency": DevAgencyTemplate,
  "ecommerce-luxe": EcommerceTemplate,
  "ecommerce-tech-agency": EcommerceTechAgencyTemplate,
  "ecommerce-cesco": EcommerceCescoTemplate,
  "ecommerce-ciseco-home": EcommerceCisecoHomeTemplate,
} as const;

export function CatalogPage(props: CatalogPageProps) {
  const Template =
    TEMPLATE_COMPONENTS[props.data.website.templateKey] ??
    DevAgencyTemplate;
  return <Template {...props} />;
}
