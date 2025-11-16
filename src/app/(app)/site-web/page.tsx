import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import { getWebsiteAdminPayload } from "@/server/website";
import { Button } from "@/components/ui/button";
import type { WebsiteTemplateKey } from "@/lib/website/templates";
import { DEFAULT_PRIMARY_CTA_LABEL } from "@/lib/website/defaults";
import {
  DomainCardSkeleton,
  ProductSummaryCardSkeleton,
  PublishCardSkeleton,
  WebsiteContentFormSkeleton,
} from "@/app/(app)/site-web/_components/site-web-skeletons";

const WebsiteContentForm = nextDynamic(
  () =>
    import("@/app/(app)/site-web/_components/website-content-form").then(
      (mod) => ({
        default: mod.WebsiteContentForm,
      }),
    ),
  { loading: () => <WebsiteContentFormSkeleton /> },
);

const DomainCard = nextDynamic(
  () =>
    import("@/app/(app)/site-web/_components/domain-card").then(
      (mod) => ({
        default: mod.DomainCard,
      }),
    ),
  { loading: () => <DomainCardSkeleton /> },
);

const PublishCard = nextDynamic(
  () =>
    import("@/app/(app)/site-web/_components/publish-card").then(
      (mod) => ({
        default: mod.PublishCard,
      }),
    ),
  { loading: () => <PublishCardSkeleton /> },
);

const ProductSummaryCard = nextDynamic(
  () =>
    import(
      "@/app/(app)/site-web/_components/product-summary-card"
    ).then((mod) => ({
      default: mod.ProductSummaryCard,
    })),
  { loading: () => <ProductSummaryCardSkeleton /> },
);

export const dynamic = "force-dynamic";

export default async function SiteWebPage() {
  const admin = await getWebsiteAdminPayload();
  const { website, links, domain, stats } = admin;

  const templateKey =
    (website.templateKey ?? "dev-agency") as WebsiteTemplateKey;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Site web public
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Publiez votre catalogue sur un domaine dédié, collectez les leads et
            mettez à jour le contenu sans coder.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <a href={links.previewUrl} target="_blank" rel="noreferrer">
              Prévisualiser
            </a>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <a
              href={`/catalogue/${website.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Voir l’URL slug
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Statut</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {website.published ? "En ligne" : "Brouillon"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Domaine</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {website.customDomain ?? "Non connecté"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Produits visibles</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {stats.listedProducts} / {stats.totalProducts}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Slug</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {website.slug}
          </p>
        </div>
      </div>

      <Suspense fallback={<WebsiteContentFormSkeleton />}>
        <WebsiteContentForm
          defaultValues={{
            slug: website.slug ?? "",
            templateKey,
            heroEyebrow: website.heroEyebrow,
            heroTitle: website.heroTitle,
            heroSubtitle: website.heroSubtitle,
            heroPrimaryCtaLabel:
              website.heroPrimaryCtaLabel ?? DEFAULT_PRIMARY_CTA_LABEL,
            heroSecondaryCtaLabel: website.heroSecondaryCtaLabel,
            heroSecondaryCtaUrl: website.heroSecondaryCtaUrl,
            aboutTitle: website.aboutTitle,
            aboutBody: website.aboutBody,
            contactBlurb: website.contactBlurb,
            contactEmailOverride: website.contactEmailOverride,
            contactPhoneOverride: website.contactPhoneOverride,
            contactAddressOverride: website.contactAddressOverride,
            seoTitle: website.seoTitle,
            seoDescription: website.seoDescription,
            seoKeywords: website.seoKeywords,
            socialImageUrl: website.socialImageUrl,
            accentColor: website.accentColor,
            theme: website.theme,
            showPrices: website.showPrices,
            showInactiveProducts: website.showInactiveProducts,
            leadNotificationEmail: website.leadNotificationEmail,
            leadAutoTag: website.leadAutoTag,
            leadThanksMessage: website.leadThanksMessage,
            spamProtectionEnabled: website.spamProtectionEnabled,
          }}
        />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<DomainCardSkeleton />}>
          <DomainCard
            customDomain={website.customDomain}
            status={website.domainStatus}
            verificationCode={domain.verificationCode}
            edgeDomain={domain.target}
          />
        </Suspense>
        <Suspense fallback={<PublishCardSkeleton />}>
          <PublishCard
            published={website.published}
            slugUrl={links.slugPreviewUrl}
            previewUrl={links.previewUrl}
          />
        </Suspense>
      </div>

      <Suspense fallback={<ProductSummaryCardSkeleton />}>
        <ProductSummaryCard stats={stats} />
      </Suspense>
    </div>
  );
}
