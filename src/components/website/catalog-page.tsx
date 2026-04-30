import type { CatalogPayload } from "@/server/website";
import type { CisecoLocale } from "@/components/website/templates/ecommerce-ciseco/locale";
import { DevAgencyTemplate } from "@/components/website/templates/dev-agency";
import { EcommerceCescoTemplate } from "@/components/website/templates/ecommerce-cesco";
import { EcommerceCisecoHomeTemplate } from "@/components/website/templates/ecommerce-ciseco-home";
import { EcommerceTechAgencyTemplate } from "@/components/website/templates/ecommerce-tech-agency";
import { EcommerceTemplate } from "@/components/website/templates/ecommerce";

type CatalogPageProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
  initialLocale?: CisecoLocale;
  resolvedByDomain?: boolean;
};

export function CatalogPage(props: CatalogPageProps) {
  switch (props.data.website.templateKey) {
    case "ecommerce-luxe":
      return <EcommerceTemplate {...props} />;
    case "ecommerce-tech-agency":
      return <EcommerceTechAgencyTemplate {...props} />;
    case "ecommerce-cesco":
      return <EcommerceCescoTemplate {...props} />;
    case "ecommerce-ciseco-home":
      return <EcommerceCisecoHomeTemplate {...props} />;
    case "dev-agency":
    default:
      return <DevAgencyTemplate {...props} />;
  }
}
