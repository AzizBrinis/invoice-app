import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAppHostnames } from "@/lib/env";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import {
  externalizeCatalogProductInlineImages,
  type CatalogProduct,
  normalizeCatalogDomainInput,
  normalizeCatalogSlugInput,
  resolveCatalogWebsite,
} from "@/server/website";

const APP_HOSTS = new Set(getAppHostnames());
const APP_HOSTNAMES = new Set(
  Array.from(APP_HOSTS)
    .map((entry) => normalizeCatalogDomainInput(entry))
    .filter((entry): entry is string => Boolean(entry)),
);

const catalogProductSelect = {
  id: true,
  name: true,
  description: true,
  descriptionHtml: true,
  shortDescriptionHtml: true,
  excerpt: true,
  metaTitle: true,
  metaDescription: true,
  coverImageUrl: true,
  gallery: true,
  faqItems: true,
  quoteFormSchema: true,
  optionConfig: true,
  variantStock: true,
  category: true,
  unit: true,
  stockQuantity: true,
  priceHTCents: true,
  priceTTCCents: true,
  vatRate: true,
  defaultDiscountRate: true,
  defaultDiscountAmountCents: true,
  sku: true,
  publicSlug: true,
  saleMode: true,
  isActive: true,
  createdAt: true,
} as const;

function resolveCatalogProductSlug(
  product: Pick<CatalogProduct, "id" | "name" | "publicSlug" | "sku">,
) {
  if (product.publicSlug && product.publicSlug.trim().length > 0) {
    return product.publicSlug;
  }
  const base = product.sku || product.name || product.id;
  return slugify(base) || product.id.slice(0, 8);
}

function resolveDomainAndSlug(
  request: NextRequest,
  fallbackSlug?: string | null,
) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const normalizedHost = normalizeCatalogDomainInput(host);
  const isAppHost =
    APP_HOSTS.has(host) ||
    (normalizedHost ? APP_HOSTNAMES.has(normalizedHost) : false);

  return {
    slug: isAppHost ? normalizeCatalogSlugInput(fallbackSlug) : null,
    domain: isAppHost ? null : normalizedHost,
  };
}

export async function GET(request: NextRequest) {
  const rawSlug = request.nextUrl.searchParams.get("slug");
  const productSlug = normalizeCatalogSlugInput(
    request.nextUrl.searchParams.get("product"),
  );

  if (!productSlug) {
    return NextResponse.json(
      { error: "Missing product slug." },
      { status: 400 },
    );
  }

  const { slug, domain } = resolveDomainAndSlug(request, rawSlug);
  const website = await resolveCatalogWebsite({
    slug,
    domain,
    preview: false,
  });

  if (!website) {
    return NextResponse.json({ error: "Catalog not found." }, { status: 404 });
  }

  const where = {
    userId: website.userId,
    isListedInCatalog: true,
    ...(website.showInactiveProducts ? {} : { isActive: true }),
  } as const;

  let product = await prisma.product.findFirst({
    where: {
      ...where,
      publicSlug: productSlug,
    },
    select: catalogProductSelect,
  });

  if (!product) {
    const candidates = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        publicSlug: true,
      },
    });
    const fallbackMatch = candidates.find(
      (entry) => resolveCatalogProductSlug(entry) === productSlug,
    );
    if (fallbackMatch) {
      product = await prisma.product.findFirst({
        where: {
          ...where,
          id: fallbackMatch.id,
        },
        select: catalogProductSelect,
      });
    }
  }

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json({
    product: externalizeCatalogProductInlineImages(
      product as CatalogProduct,
      website,
    ),
  });
}
