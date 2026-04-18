import type { CatalogPayload } from "@/server/website";
import type { CisecoLocale } from "@/components/website/templates/ecommerce-ciseco/locale";

type CatalogPageProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
  initialLocale?: CisecoLocale;
  resolvedByDomain?: boolean;
};

async function resolveTemplateComponent(
  templateKey: CatalogPayload["website"]["templateKey"],
) {
  switch (templateKey) {
    case "ecommerce-luxe": {
      const module = await import("@/components/website/templates/ecommerce");
      return module.EcommerceTemplate;
    }
    case "ecommerce-tech-agency": {
      const module = await import(
        "@/components/website/templates/ecommerce-tech-agency"
      );
      return module.EcommerceTechAgencyTemplate;
    }
    case "ecommerce-cesco": {
      const module = await import(
        "@/components/website/templates/ecommerce-cesco"
      );
      return module.EcommerceCescoTemplate;
    }
    case "ecommerce-ciseco-home": {
      const module = await import(
        "@/components/website/templates/ecommerce-ciseco-home"
      );
      return module.EcommerceCisecoHomeTemplate;
    }
    case "dev-agency":
    default: {
      const module = await import("@/components/website/templates/dev-agency");
      return module.DevAgencyTemplate;
    }
  }
}

export async function CatalogPage(props: CatalogPageProps) {
  const Template = await resolveTemplateComponent(
    props.data.website.templateKey,
  );
  return <Template {...props} />;
}
