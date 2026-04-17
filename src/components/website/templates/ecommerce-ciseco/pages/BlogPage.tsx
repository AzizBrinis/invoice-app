import clsx from "clsx";
import type { CSSProperties } from "react";
import type {
  WebsiteBuilderPageConfig,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { CatalogPayload } from "@/server/website";
import type { ThemeTokens } from "../types";
import {
  resolveBuilderMedia,
  resolveBuilderSectionBySignature,
} from "../builder-helpers";
import { resolveCisecoNavigationHref } from "../utils";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Reveal } from "../components/shared/Reveal";
import { CatalogImage } from "../components/shared/CatalogImage";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useCisecoI18n } from "../i18n";
import { formatCisecoDate } from "../locale";

type BlogPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  baseLink: (target: string) => string;
  path?: string | null;
  builder?: WebsiteBuilderPageConfig | null;
  blogPosts?: CatalogPayload["blogPosts"];
};

type BlogAuthor = {
  name: string;
  avatar?: string | null;
  date: string;
  readTime?: string | null;
};

type BlogArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  category?: string | null;
  author: BlogAuthor;
  featured?: boolean;
};

const BLOG_IMAGES = {
  featured:
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
  secondary:
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
  tertiary:
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  fourth:
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
  promo:
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
} as const;

const BLOG_AUTHORS = [
  {
    name: "Scott Wolkowski",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80",
    date: "2025-09-30",
    readTime: "5 min read",
  },
  {
    name: "Erica Alexander",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
    date: "2025-09-24",
    readTime: "6 min read",
  },
  {
    name: "Willie Edwards",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
    date: "2025-09-16",
    readTime: "4 min read",
  },
  {
    name: "Alex Klein",
    avatar:
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=120&q=80",
    date: "2025-09-10",
    readTime: "7 min read",
  },
] as const;

const LEGACY_ARTICLES: BlogArticle[] = [
  {
    id: "featured-graduation",
    slug: "graduation-dresses-style-guide",
    title: "Graduation Dresses: A Style Guide",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus unde.",
    image: BLOG_IMAGES.featured,
    category: "Editorial",
    author: BLOG_AUTHORS[0],
    featured: true,
  },
  {
    id: "eid-pieces",
    slug: "eid-pieces-all-year",
    title: "How To Wear Your Eid Pieces All Year Long",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo.",
    image: BLOG_IMAGES.secondary,
    category: "Guide",
    author: BLOG_AUTHORS[1],
  },
  {
    id: "hijabi-2024",
    slug: "hijabi-friendly-fabrics-2024",
    title: "The Must-Have Hijabi Friendly Fabrics For 2024",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo.",
    image: BLOG_IMAGES.tertiary,
    category: "Insight",
    author: BLOG_AUTHORS[2],
  },
  {
    id: "hijabi-2025",
    slug: "hijabi-friendly-fabrics-2025",
    title: "The Hijabi Friendly Fabrics For 2025",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo.",
    image: BLOG_IMAGES.fourth,
    category: "Trend",
    author: BLOG_AUTHORS[3],
  },
  {
    id: "conversion",
    slug: "boost-conversion-rate",
    title: "Boost your conversion rate",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo.",
    image: BLOG_IMAGES.promo,
    category: "Growth",
    author: BLOG_AUTHORS[0],
  },
];

const ARTICLES_PER_PAGE = 6;

const DEFAULT_BLOG_HERO_TITLES = ["Journal"] as const;
const DEFAULT_BLOG_HERO_SUBTITLES = [
  "Suivez nos dernières actualités et inspirations.",
  "Follow our latest news and inspiration.",
] as const;

function normalizeBlogText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim().toLocaleLowerCase() ?? "";
}

function matchesDefaultBlogCopy(
  value: string | null | undefined,
  candidates: readonly string[],
) {
  const normalized = normalizeBlogText(value);
  if (!normalized) {
    return false;
  }
  return candidates.some(
    (candidate) => normalizeBlogText(candidate) === normalized,
  );
}

function resolveReadTimeLabel(
  minutes: number | null | undefined,
  locale: "fr" | "en",
) {
  const value = Math.max(1, minutes ?? 1);
  return locale === "fr" ? `${value} min de lecture` : `${value} min read`;
}

function buildManagedArticles(
  blogPosts: NonNullable<CatalogPayload["blogPosts"]>,
  locale: "fr" | "en",
): BlogArticle[] {
  return blogPosts.map((post, index) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt:
      post.excerpt ??
      (locale === "fr"
        ? "Découvrez les dernières nouvelles de notre journal éditorial."
        : "Read the latest update from our editorial journal."),
    image:
      post.coverImageUrl ??
      Object.values(BLOG_IMAGES)[index % Object.values(BLOG_IMAGES).length] ??
      BLOG_IMAGES.featured,
    category:
      post.category ??
      post.tags[0] ??
      (post.featured ? "Featured" : "Story"),
    author: {
      name: post.authorName,
      date: post.publishDate ?? new Date().toISOString(),
      readTime: resolveReadTimeLabel(post.readingTimeMinutes, locale),
    },
    featured: post.featured,
  }));
}

function resolveLegacyArticle(
  item:
    | WebsiteBuilderPageConfig["sections"][number]["items"][number]
    | undefined,
  fallback: BlogArticle,
): BlogArticle {
  if (!item) {
    return fallback;
  }
  return {
    ...fallback,
    id: item.id ?? fallback.id,
    slug: item.href?.replace(/^\/?(?:blog|journal)\//i, "") ?? fallback.slug,
    title: item.title ?? fallback.title,
    excerpt: item.description ?? fallback.excerpt,
    category: item.tag ?? fallback.category,
    author: {
      ...fallback.author,
      name: item.tag ?? fallback.author.name,
      date: item.badge ?? fallback.author.date,
    },
  };
}

function buildInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function BlogPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  baseLink,
  path,
  builder,
  blogPosts,
}: BlogPageProps) {
  const { t, locale } = useCisecoI18n();
  const container = clsx("mx-auto px-6 sm:px-8", theme.containerClass);
  const hasBuilder = Boolean(builder);
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-blog-hero",
    type: "hero",
    layouts: ["page-hero", "split"],
  });
  const featuredSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-blog-featured",
    type: "content",
    layouts: "blog-featured",
  });
  const miniSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-blog-mini",
    type: "gallery",
    layouts: "blog-mini",
  });
  const adsSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-blog-ads",
    type: "content",
    layouts: "blog-ads",
  });
  const latestSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-blog-latest",
    type: "content",
    layouts: "blog-latest",
  });
  const promoSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-blog-promo",
    type: "promo",
    layouts: "blog-promo",
  });

  const legacyFeatured = featuredSection?.items?.[0]
    ? {
        ...resolveLegacyArticle(featuredSection.items[0], LEGACY_ARTICLES[0]),
        image:
          resolveBuilderMedia(featuredSection.items[0].mediaId, mediaLibrary)?.src ??
          LEGACY_ARTICLES[0].image,
      }
    : LEGACY_ARTICLES[0];
  const legacyMini = miniSection?.items?.length
    ? miniSection.items.slice(0, 3).map((item, index) => ({
        ...resolveLegacyArticle(item, LEGACY_ARTICLES[index + 1] ?? LEGACY_ARTICLES[0]),
        image:
          resolveBuilderMedia(item.mediaId, mediaLibrary)?.src ??
          LEGACY_ARTICLES[index + 1]?.image ??
          LEGACY_ARTICLES[0].image,
      }))
    : LEGACY_ARTICLES.slice(1, 4);
  const legacyLatest = latestSection?.items?.length
    ? latestSection.items.map((item, index) => ({
        ...resolveLegacyArticle(item, LEGACY_ARTICLES[index] ?? LEGACY_ARTICLES[0]),
        image:
          resolveBuilderMedia(item.mediaId, mediaLibrary)?.src ??
          LEGACY_ARTICLES[index]?.image ??
          LEGACY_ARTICLES[0].image,
      }))
    : LEGACY_ARTICLES.slice(1);

  const allArticles =
    blogPosts !== undefined
      ? buildManagedArticles(blogPosts, locale)
      : [legacyFeatured, ...legacyMini, ...legacyLatest].filter(
          (entry, index, source) =>
            source.findIndex((candidate) => candidate.slug === entry.slug) === index,
        );
  const featuredPost = allArticles.find((entry) => entry.featured) ?? allArticles[0] ?? null;
  const listingSource = featuredPost
    ? allArticles.filter((entry) => entry.slug !== featuredPost.slug)
    : allArticles;

  const pageMatch =
    typeof path === "string" ? path.match(/\/blog\/page-(\d+)/i) : null;
  const parsedPage = pageMatch ? Number(pageMatch[1]) : 1;
  const totalPages = Math.max(
    1,
    Math.ceil(listingSource.length / ARTICLES_PER_PAGE),
  );
  const currentPage =
    Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, totalPages)
      : 1;
  const currentPagePosts = listingSource.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE,
  );
  const miniPosts = currentPage === 1 ? currentPagePosts.slice(0, 3) : [];
  const latestPosts =
    currentPage === 1 ? currentPagePosts.slice(3) : currentPagePosts;
  const paginationPages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;
  const resolvedHeroEyebrow = heroSection?.eyebrow ?? "Blog";
  const resolvedHeroTitle =
    heroSection?.title && !matchesDefaultBlogCopy(heroSection.title, DEFAULT_BLOG_HERO_TITLES)
      ? heroSection.title
      : locale === "en"
        ? "Guides, advice, and updates"
        : "Guides, conseils et actualités";
  const resolvedHeroSubtitle =
    heroSubtitle && !matchesDefaultBlogCopy(heroSubtitle, DEFAULT_BLOG_HERO_SUBTITLES)
      ? heroSubtitle
      : locale === "en"
        ? "Read practical guides, product advice, and the latest updates published by the store."
        : "Retrouvez des guides pratiques, des conseils produit et les dernières actualités publiés par la boutique.";
  const promoImage = resolveBuilderMedia(promoSection?.mediaId, mediaLibrary);
  const promoButtonHref = resolveCisecoNavigationHref({
    href: promoSection?.buttons?.[0]?.href ?? "/contact",
    baseLink,
    homeHref,
    fallbackPath: "/contact",
  });
  const consumedIds = new Set(
    [
      heroSection,
      featuredSection,
      miniSection,
      adsSection,
      latestSection,
      promoSection,
    ]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) => section.visible !== false && !consumedIds.has(section.id),
  );

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main className="pb-16">
        <section className={clsx(container, "pt-8 sm:pt-10 lg:pt-12")}>
          {(Boolean(heroSection) || !hasBuilder) && (
            <div className="mb-10 max-w-3xl space-y-3" data-builder-section={heroSection?.id}>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--site-accent)]">
                {t(resolvedHeroEyebrow)}
              </p>
              <h1 className="font-[family:var(--ciseco-font-display)] text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                {t(resolvedHeroTitle)}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                {t(resolvedHeroSubtitle)}
              </p>
            </div>
          )}

          {blogPosts !== undefined && allArticles.length === 0 ? (
            <EmptyBlogState />
          ) : (
            <div
              className={clsx(
                "grid gap-8",
                featuredPost && miniPosts.length
                  ? "lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
                  : "grid-cols-1",
              )}
            >
              {featuredPost ? (
                <div data-builder-section={featuredSection?.id}>
                  <Reveal delay={40}>
                    <FeaturedPostCard
                      post={featuredPost}
                      href={baseLink(`/blog/${featuredPost.slug}`)}
                    />
                  </Reveal>
                </div>
              ) : null}
              {miniPosts.length ? (
                <div className="space-y-4" data-builder-section={miniSection?.id}>
                  {miniPosts.map((post, index) => (
                    <Reveal key={post.id} delay={80 + index * 50}>
                      <CompactPostCard
                        post={post}
                        href={baseLink(`/blog/${post.slug}`)}
                      />
                    </Reveal>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </section>

        {(Boolean(adsSection) || !hasBuilder) && (
          <section className={clsx(container, "mt-10 sm:mt-12")}>
            <div data-builder-section={adsSection?.id}>
              <Reveal delay={120}>
                <AdsBanner
                  eyebrow={adsSection?.eyebrow ?? "Editorial"}
                  title={adsSection?.title ?? "Ideas that turn catalogue traffic into trust"}
                  description={
                    adsSection?.description ??
                    adsSection?.subtitle ??
                    "Publish practical content around your products to answer objections before buyers ask."
                  }
                />
              </Reveal>
            </div>
          </section>
        )}

        {(Boolean(latestSection) || !hasBuilder) && (
          <section className={clsx(container, "mt-12 sm:mt-14")} data-builder-section={latestSection?.id}>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {t(latestSection?.title ?? "Latest articles")}
              </h2>
              <PinIcon className="h-4 w-4 text-rose-500" />
            </div>

            {latestPosts.length ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {latestPosts.map((post, index) => (
                  <Reveal key={post.id} delay={80 + index * 50}>
                    <ArticleCard
                      post={post}
                      href={baseLink(`/blog/${post.slug}`)}
                    />
                  </Reveal>
                ))}
              </div>
            ) : blogPosts !== undefined && allArticles.length > 0 ? (
              <div className="mt-6 rounded-[28px] border border-dashed border-black/10 bg-white/90 px-6 py-10 text-center shadow-[0_20px_60px_-48px_rgba(15,23,42,0.42)]">
                <p className="text-base font-medium text-slate-600">
                  {t("There are no additional articles on this page yet.")}
                </p>
              </div>
            ) : null}

            {paginationPages.length > 1 ? (
              <PaginationBar
                pages={paginationPages}
                currentPage={currentPage}
                hrefForPage={(page) =>
                  page === 1 ? baseLink("/blog") : baseLink(`/blog/page-${page}`)
                }
              />
            ) : null}
          </section>
        )}

        {(Boolean(promoSection) || !hasBuilder) && (
          <section className={clsx(container, "mt-12 sm:mt-14")}>
            <div data-builder-section={promoSection?.id}>
              <Reveal delay={120}>
                <PromoBanner
                  companyName={companyName}
                  title={promoSection?.title ?? "Publish product stories that continue selling for you"}
                  description={
                    promoSection?.description ??
                    promoSection?.subtitle ??
                    "Turn launches, buying guides, and customer education into durable evergreen pages."
                  }
                  buttonLabel={promoSection?.buttons?.[0]?.label ?? "Contact us"}
                  buttonHref={promoButtonHref}
                  image={promoImage?.src ?? BLOG_IMAGES.promo}
                />
              </Reveal>
            </div>
          </section>
        )}

        {extraSections.length ? (
          <ExtraSections
            theme={theme}
            sections={extraSections}
            mediaLibrary={mediaLibrary}
          />
        ) : null}
      </main>
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}

function EmptyBlogState() {
  const { t } = useCisecoI18n();

  return (
    <div className="rounded-[32px] border border-dashed border-black/10 bg-white/92 px-6 py-12 text-center shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)] sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--site-accent)]">
        {t("Blog")}
      </p>
      <h2 className="mt-4 font-[family:var(--ciseco-font-display)] text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
        {t("No published articles yet")}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
        {t("This journal will fill automatically when the first post is published from the admin workspace.")}
      </p>
    </div>
  );
}

type PostCardProps = {
  post: BlogArticle;
  href: string;
};

function FeaturedPostCard({ post, href }: PostCardProps) {
  const { t } = useCisecoI18n();

  return (
    <a href={href} className="group block">
      <article className="overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-[0_24px_80px_-50px_rgba(15,23,42,0.42)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_32px_92px_-46px_rgba(15,23,42,0.46)]">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <CatalogImage
            src={post.image}
            alt={t(post.title)}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 58vw, 92vw"
            priority
            fill
          />
        </div>
        <div className="space-y-4 p-6 sm:p-7">
          {post.category ? (
            <span className="inline-flex rounded-full bg-[color:var(--site-accent-soft,#e8f3ef)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--site-accent)]">
              {t(post.category)}
            </span>
          ) : null}
          <div className="space-y-2">
            <h2 className="font-[family:var(--ciseco-font-display)] text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-3xl">
              {t(post.title)}
            </h2>
            <p className="text-sm leading-7 text-slate-600 sm:text-base">
              {t(post.excerpt)}
            </p>
          </div>
          <AuthorRow author={post.author} />
        </div>
      </article>
    </a>
  );
}

function CompactPostCard({ post, href }: PostCardProps) {
  const { t } = useCisecoI18n();

  return (
    <a href={href} className="group block">
      <article className="flex h-full gap-4 rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.38)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_72px_-40px_rgba(15,23,42,0.42)]">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100">
          <CatalogImage
            src={post.image}
            alt={t(post.title)}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.05]"
            sizes="96px"
            loading="lazy"
            fill
          />
        </div>
        <div className="min-w-0 space-y-2">
          {post.category ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--site-accent)]">
              {t(post.category)}
            </p>
          ) : null}
          <h3 className="text-base font-semibold leading-6 text-slate-950">
            {t(post.title)}
          </h3>
          <p className="line-clamp-2 text-sm leading-6 text-slate-500">
            {t(post.excerpt)}
          </p>
          <AuthorRow author={post.author} compact />
        </div>
      </article>
    </a>
  );
}

function ArticleCard({ post, href }: PostCardProps) {
  const { t } = useCisecoI18n();

  return (
    <a href={href} className="group block">
      <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_22px_54px_-38px_rgba(15,23,42,0.46)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_28px_72px_-36px_rgba(15,23,42,0.45)]">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <CatalogImage
            src={post.image}
            alt={t(post.title)}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw"
            loading="lazy"
            fill
          />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
          {post.category ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--site-accent)]">
              {t(post.category)}
            </p>
          ) : null}
          <h3 className="font-[family:var(--ciseco-font-display)] text-[23px] font-semibold leading-[1.1] tracking-[-0.03em] text-slate-950">
            {t(post.title)}
          </h3>
          <p className="text-sm leading-7 text-slate-500">
            {t(post.excerpt)}
          </p>
          <div className="mt-auto pt-2">
            <AuthorRow author={post.author} compact />
          </div>
        </div>
      </article>
    </a>
  );
}

type AuthorRowProps = {
  author: BlogAuthor;
  compact?: boolean;
};

function AuthorRow({ author, compact = false }: AuthorRowProps) {
  const { locale } = useCisecoI18n();
  const avatarSize = compact ? 24 : 32;

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-2 text-slate-500",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      {author.avatar ? (
        <CatalogImage
          src={author.avatar}
          alt={author.name}
          className={clsx(
            "rounded-full object-cover",
            compact ? "h-6 w-6" : "h-8 w-8",
          )}
          width={avatarSize}
          height={avatarSize}
          sizes={`${avatarSize}px`}
          loading="lazy"
        />
      ) : (
        <span
          className={clsx(
            "inline-flex items-center justify-center rounded-full bg-slate-900 font-semibold text-white",
            compact ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-[11px]",
          )}
        >
          {buildInitials(author.name)}
        </span>
      )}
      <span className="font-semibold text-slate-700">{author.name}</span>
      <span aria-hidden="true" className="text-slate-300">
        &middot;
      </span>
      <span>{formatCisecoDate(locale, author.date)}</span>
      {author.readTime ? (
        <>
          <span aria-hidden="true" className="text-slate-300">
            &middot;
          </span>
          <span>{author.readTime}</span>
        </>
      ) : null}
    </div>
  );
}

type AdsBannerProps = {
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
};

function AdsBanner({ eyebrow, title, description }: AdsBannerProps) {
  const { t } = useCisecoI18n();

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[#f7c9c9] px-6 py-12 text-center sm:py-14">
      <span className="text-sm font-semibold uppercase tracking-[0.55em] text-white/90">
        {t(eyebrow || "Editorial")}
      </span>
      <span className="pointer-events-none absolute left-8 top-6 hidden h-5 w-20 rounded-full border border-white/40 sm:block" />
      <span className="pointer-events-none absolute right-10 top-8 hidden h-3 w-12 rounded-full border border-white/40 sm:block" />
      <span className="pointer-events-none absolute bottom-6 left-12 hidden h-3 w-12 rounded-full border border-white/40 sm:block" />
      <div className="mt-4 space-y-2">
        {title ? (
          <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {t(title)}
          </h3>
        ) : null}
        {description ? (
          <p className="mx-auto max-w-2xl text-sm text-slate-700/80">
            {t(description)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type PaginationBarProps = {
  pages: number[];
  currentPage: number;
  hrefForPage: (page: number) => string;
};

function PaginationBar({ pages, currentPage, hrefForPage }: PaginationBarProps) {
  const { t } = useCisecoI18n();
  const totalPages = Math.max(...pages);
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-500">
      <a
        href={hrefForPage(previousPage)}
        className={clsx(
          "flex items-center gap-2 text-slate-600 transition hover:text-slate-900",
          currentPage === 1 && "pointer-events-none text-slate-300",
        )}
        aria-disabled={currentPage === 1}
      >
        <span aria-hidden="true">&larr;</span>
        {t("Previous")}
      </a>
      <div className="flex items-center gap-2">
        {pages.map((page) => (
          <a
            key={page}
            href={hrefForPage(page)}
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-full transition",
              page === currentPage
                ? "bg-slate-100 text-slate-900"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
            )}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </a>
        ))}
      </div>
      <a
        href={hrefForPage(nextPage)}
        className={clsx(
          "flex items-center gap-2 text-slate-600 transition hover:text-slate-900",
          currentPage === totalPages && "pointer-events-none text-slate-300",
        )}
        aria-disabled={currentPage === totalPages}
      >
        {t("Next")}
        <span aria-hidden="true">&rarr;</span>
      </a>
    </div>
  );
}

type PromoBannerProps = {
  companyName: string;
  title?: string | null;
  description?: string | null;
  buttonLabel?: string | null;
  buttonHref?: string | null;
  image?: string | null;
};

function PromoBanner({
  companyName,
  title,
  description,
  buttonLabel,
  buttonHref,
  image,
}: PromoBannerProps) {
  const { t } = useCisecoI18n();

  return (
    <div className="relative overflow-hidden rounded-[32px] bg-[#fff6d6] px-6 py-10 sm:px-10 sm:py-12">
      <span className="pointer-events-none absolute left-10 top-6 h-2 w-2 rounded-full bg-rose-400" />
      <span className="pointer-events-none absolute right-16 top-8 h-3 w-3 rounded-full bg-emerald-400" />
      <span className="pointer-events-none absolute bottom-8 right-20 h-2 w-2 rounded-full bg-amber-400" />
      <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="relative mx-auto w-full max-w-[300px] sm:max-w-none">
          <CatalogImage
            src={image ?? BLOG_IMAGES.promo}
            alt={t("Editorial illustration")}
            className="h-full w-full rounded-[28px] object-cover"
            width={560}
            height={560}
            sizes="(min-width: 640px) 42vw, 300px"
            loading="lazy"
          />
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>{companyName}</span>
            <span className="text-[var(--site-accent)]">.</span>
          </div>
          <h3 className="font-[family:var(--ciseco-font-display)] text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-3xl">
            {t(title ?? "Special offer in editorial content")}
          </h3>
          <p className="text-sm leading-7 text-slate-500">
            {t(
              description ??
                "Plan your next product story, customer guide, or category explainer with a cleaner editorial system.",
            )}
          </p>
          <a
            href={buttonHref ?? "#"}
            className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm"
          >
            {t(buttonLabel ?? "Discover more")}
          </a>
        </div>
      </div>
    </div>
  );
}

type IconProps = {
  className?: string;
};

function PinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3.5c-3 0-5.5 2.4-5.5 5.4 0 4.1 4.7 9.3 5.1 9.8.2.2.5.2.7 0 .4-.5 5.1-5.7 5.1-9.8 0-3-2.5-5.4-5.4-5.4z"
        fill="currentColor"
      />
      <circle cx="12" cy="8.9" r="2" fill="white" />
    </svg>
  );
}
