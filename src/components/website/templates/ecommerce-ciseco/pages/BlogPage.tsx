import clsx from "clsx";
import type { CSSProperties } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import {
  resolveBuilderMedia,
  resolveBuilderSectionBySignature,
} from "../builder-helpers";
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
};

type BlogAuthor = {
  name: string;
  avatar: string;
  date: string;
};

type BlogArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  author: BlogAuthor;
};

const BLOG_IMAGES = {
  signpost:
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  pool:
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  beach:
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
  mountain:
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80",
  coast:
    "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=900&q=80",
  fashion:
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
  kids:
    "https://images.unsplash.com/photo-1503455637927-730bce8583c0?auto=format&fit=crop&w=900&q=80",
};

const BLOG_AUTHORS = {
  scott: {
    name: "Scott Wolkowski",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80",
    date: "Mar 18, 2020",
  },
  erica: {
    name: "Erica Alexander",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
    date: "Mar 16, 2020",
  },
  willie: {
    name: "Willie Edwards",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
    date: "Mar 18, 2020",
  },
  alex: {
    name: "Alex Klein",
    avatar:
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=120&q=80",
    date: "Mar 18, 2020",
  },
  edon: {
    name: "Edon Brich",
    avatar:
      "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?auto=format&fit=crop&w=120&q=80",
    date: "Mar 18, 2020",
  },
};

const FEATURED_POST: BlogArticle = {
  id: "featured-graduation",
  slug: "graduation-dresses-style-guide",
  title: "Graduation Dresses: A Style Guide",
  excerpt:
    "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus unde.",
  image: BLOG_IMAGES.signpost,
  author: BLOG_AUTHORS.scott,
};

const MINI_POSTS: BlogArticle[] = [
  {
    id: "eid-pieces",
    slug: "eid-pieces-all-year",
    title: "How To Wear Your Eid Pieces All Year Long",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus...",
    image: BLOG_IMAGES.pool,
    author: BLOG_AUTHORS.erica,
  },
  {
    id: "hijabi-2024",
    slug: "hijabi-friendly-fabrics-2024",
    title: "The Must-Have Hijabi Friendly Fabrics For 2024",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus...",
    image: BLOG_IMAGES.beach,
    author: BLOG_AUTHORS.willie,
  },
  {
    id: "hijabi-2025",
    slug: "hijabi-friendly-fabrics-2025",
    title: "The Hijabi Friendly Fabrics For 2025",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus...",
    image: BLOG_IMAGES.mountain,
    author: BLOG_AUTHORS.alex,
  },
];

const LATEST_ARTICLES: BlogArticle[] = [
  {
    id: "latest-graduation",
    slug: "graduation-dresses-style-guide",
    title: "Graduation Dresses: A Style Guide",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus...",
    image: BLOG_IMAGES.signpost,
    author: BLOG_AUTHORS.scott,
  },
  {
    id: "latest-eid",
    slug: "eid-pieces-all-year",
    title: "How to Wear Your Eid Pieces All Year Long",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus...",
    image: BLOG_IMAGES.pool,
    author: BLOG_AUTHORS.erica,
  },
  {
    id: "latest-hijabi-2024",
    slug: "hijabi-friendly-fabrics-2024",
    title: "The Must-Have Hijabi Friendly Fabrics for 2024",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus...",
    image: BLOG_IMAGES.beach,
    author: BLOG_AUTHORS.willie,
  },
  {
    id: "latest-hijabi-2025",
    slug: "hijabi-friendly-fabrics-2025",
    title: "The Hijabi Friendly Fabrics for 2025",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus...",
    image: BLOG_IMAGES.mountain,
    author: BLOG_AUTHORS.alex,
  },
  {
    id: "latest-conversion",
    slug: "boost-conversion-rate",
    title: "Boost your conversion rate",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus...",
    image: BLOG_IMAGES.coast,
    author: BLOG_AUTHORS.edon,
  },
  {
    id: "latest-graduation-2",
    slug: "graduation-dresses-style-guide-2",
    title: "Graduation Dresses: A Style Guide",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus...",
    image: BLOG_IMAGES.fashion,
    author: BLOG_AUTHORS.scott,
  },
];

const PAGINATION_PAGES = [1, 2, 3, 4];

export function BlogPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  baseLink,
  path,
  builder,
}: BlogPageProps) {
  const { t } = useCisecoI18n();
  const container = clsx("mx-auto px-6 sm:px-8", theme.containerClass);
  const blogHref = (slug: string) => baseLink(`/blog/${slug}`);
  const pageHref = (page: number) =>
    page === 1 ? baseLink("/blog") : baseLink(`/blog/page-${page}`);
  const totalPages = Math.max(...PAGINATION_PAGES);
  const pageMatch =
    typeof path === "string" ? path.match(/\/blog\/page-(\d+)/i) : null;
  const parsedPage = pageMatch ? Number(pageMatch[1]) : 1;
  const currentPage =
    Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, totalPages)
      : 1;
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

  const resolveArticle = (
    item: WebsiteBuilderPageConfig["sections"][number]["items"][number] | undefined,
    fallback: BlogArticle,
    author: BlogAuthor,
  ) => {
    if (!item) {
      return fallback;
    }
    const media = resolveBuilderMedia(item.mediaId, mediaLibrary);
    return {
      id: item.id ?? fallback.id,
      slug: item.href ?? fallback.slug,
      title: item.title ?? fallback.title,
      excerpt: item.description ?? fallback.excerpt,
      image: media?.src ?? fallback.image,
      author: {
        ...author,
        name: item.tag ?? author.name,
        date: item.badge ?? author.date,
      },
    } satisfies BlogArticle;
  };

  const featuredPost = featuredSection?.items?.length
    ? resolveArticle(
        featuredSection.items[0],
        FEATURED_POST,
        FEATURED_POST.author,
      )
    : FEATURED_POST;
  const miniPosts = miniSection?.items?.length
    ? miniSection.items.map((item, index) =>
        resolveArticle(item, MINI_POSTS[index] ?? FEATURED_POST, BLOG_AUTHORS.erica),
      )
    : MINI_POSTS;
  const latestPosts = latestSection?.items?.length
    ? latestSection.items.map((item, index) =>
        resolveArticle(item, LATEST_ARTICLES[index] ?? FEATURED_POST, BLOG_AUTHORS.scott),
      )
    : LATEST_ARTICLES;
  const showHero = Boolean(heroSection) || !hasBuilder;
  const showFeatured = Boolean(featuredSection) || !hasBuilder;
  const showMini = Boolean(miniSection) || !hasBuilder;
  const showAds = Boolean(adsSection) || !hasBuilder;
  const showLatest = Boolean(latestSection) || !hasBuilder;
  const showPromo = Boolean(promoSection) || !hasBuilder;
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;
  const latestTitle = latestSection?.title ?? "Latest articles";
  const promoImage = resolveBuilderMedia(promoSection?.mediaId, mediaLibrary);
  const promoButtons =
    promoSection?.buttons?.length
      ? promoSection.buttons.map((button) => ({
          label: button.label ?? "CTA",
          href: button.href ?? "#",
        }))
      : null;
  const consumedIds = new Set(
    [heroSection, featuredSection, miniSection, adsSection, latestSection, promoSection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) =>
      section.visible !== false && !consumedIds.has(section.id),
  );

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main className="pb-16">
        <section className={clsx(container, "pt-8 sm:pt-10 lg:pt-12")}>
          {showHero ? (
            <div
              className="mb-10 space-y-2"
              data-builder-section={heroSection?.id}
            >
              {heroSection?.eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                  {t(heroSection.eyebrow)}
                </p>
              ) : null}
              <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                {t(heroSection?.title ?? "Journal")}
              </h1>
              {heroSubtitle ? (
                <p className="text-sm text-slate-600">{t(heroSubtitle)}</p>
              ) : null}
            </div>
          ) : null}
          {showFeatured || showMini ? (
            <div
              className={clsx(
                "grid gap-8",
                showFeatured && showMini
                  ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
                  : "lg:grid-cols-1",
              )}
            >
              {showFeatured ? (
                <div data-builder-section={featuredSection?.id}>
                  <Reveal delay={50}>
                    <FeaturedPost
                      post={featuredPost}
                      href={blogHref(featuredPost.slug)}
                    />
                  </Reveal>
                </div>
              ) : null}
              {showMini ? (
                <div
                  data-builder-section={miniSection?.id}
                  className={clsx(
                    "grid gap-6",
                    showFeatured
                      ? "lg:grid-cols-[minmax(0,1fr)_160px]"
                      : "sm:grid-cols-2 xl:grid-cols-3",
                  )}
                >
                  <div className="space-y-6">
                    {miniPosts.map((post, index) => (
                      <Reveal key={post.id} delay={100 + index * 80}>
                        <MiniPost post={post} href={blogHref(post.slug)} />
                      </Reveal>
                    ))}
                  </div>
                  {showFeatured ? (
                    <div className="hidden gap-4 lg:flex lg:flex-col">
                      {miniPosts.map((post) => (
                        <a
                          key={`${post.id}-image`}
                          href={blogHref(post.slug)}
                          className="group relative block aspect-[4/3] w-full overflow-hidden rounded-3xl bg-slate-100 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                        >
                          <CatalogImage
                            src={post.image}
                            alt={post.title}
                            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
                            sizes="160px"
                            loading="lazy"
                            fill
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {showAds ? (
          <section className={clsx(container, "mt-10 sm:mt-12")}>
            <div data-builder-section={adsSection?.id}>
              <Reveal delay={120}>
                <AdsBanner
                  eyebrow={adsSection?.eyebrow ?? "A.D.S"}
                  title={adsSection?.title ?? null}
                  description={adsSection?.description ?? adsSection?.subtitle ?? null}
                />
              </Reveal>
            </div>
          </section>
        ) : null}

        {showLatest ? (
          <section
            className={clsx(container, "mt-12 sm:mt-14")}
            data-builder-section={latestSection?.id}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {t(latestTitle)}
              </h2>
              <PinIcon className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latestPosts.map((post, index) => (
                <Reveal key={post.id} delay={80 + index * 60}>
                  <ArticleCard post={post} href={blogHref(post.slug)} />
                </Reveal>
              ))}
            </div>

            <PaginationBar
              pages={PAGINATION_PAGES}
              currentPage={currentPage}
              hrefForPage={pageHref}
            />
          </section>
        ) : null}

        {showPromo ? (
          <section className={clsx(container, "mt-12 sm:mt-14")}>
            <div data-builder-section={promoSection?.id}>
              <Reveal delay={120}>
                <PromoBanner
                  companyName={companyName}
                  title={promoSection?.title ?? null}
                  description={promoSection?.description ?? promoSection?.subtitle ?? null}
                  buttonLabel={promoButtons?.[0]?.label ?? null}
                  buttonHref={promoButtons?.[0]?.href ?? null}
                  image={promoImage?.src ?? null}
                />
              </Reveal>
            </div>
          </section>
        ) : null}
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

type PostProps = {
  post: BlogArticle;
  href: string;
};

function FeaturedPost({ post, href }: PostProps) {
  const { t } = useCisecoI18n();

  return (
    <a href={href} className="group block">
      <article className="space-y-4 transition hover:-translate-y-1">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px] bg-slate-100 shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
          <CatalogImage
            src={post.image}
            alt={t(post.title)}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
            sizes="(min-width: 1024px) 58vw, 92vw"
            priority
            fill
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900 transition group-hover:text-slate-950 sm:text-2xl">
            {t(post.title)}
          </h2>
          <p className="text-sm text-slate-500">{t(post.excerpt)}</p>
          <AuthorRow author={post.author} />
        </div>
      </article>
    </a>
  );
}

function MiniPost({ post, href }: PostProps) {
  const { t } = useCisecoI18n();

  return (
    <a href={href} className="group block">
      <article className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:hover:translate-y-0 lg:hover:shadow-none">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-950">
              {t(post.title)}
            </h3>
            <p className="text-xs text-slate-500">{t(post.excerpt)}</p>
          </div>
          <div className="relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100 lg:hidden">
            <CatalogImage
              src={post.image}
              alt={t(post.title)}
              className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.05]"
              sizes="80px"
              loading="lazy"
              fill
            />
          </div>
        </div>
        <AuthorRow author={post.author} compact />
      </article>
    </a>
  );
}

function ArticleCard({ post, href }: PostProps) {
  const { t } = useCisecoI18n();

  return (
    <a href={href} className="group block">
      <article className="space-y-3 transition hover:-translate-y-1">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-slate-100 shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
          <CatalogImage
            src={post.image}
            alt={t(post.title)}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
            sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw"
            loading="lazy"
            fill
          />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-950 sm:text-base">
            {t(post.title)}
          </h3>
          <p className="text-xs text-slate-500">{t(post.excerpt)}</p>
          <AuthorRow author={post.author} compact />
        </div>
      </article>
    </a>
  );
}

type AuthorRowProps = {
  author: BlogAuthor;
  compact?: boolean;
};

function AuthorRow({ author, compact }: AuthorRowProps) {
  const { locale } = useCisecoI18n();
  const avatarSize = compact ? 20 : 24;

  return (
    <div
      className={clsx(
        "flex items-center gap-2 text-slate-500",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      <CatalogImage
        src={author.avatar}
        alt={author.name}
        className={clsx(
          "rounded-full object-cover",
          compact ? "h-5 w-5" : "h-6 w-6",
        )}
        width={avatarSize}
        height={avatarSize}
        sizes={`${avatarSize}px`}
        loading="lazy"
      />
      <span className="font-semibold text-slate-700">{author.name}</span>
      <span aria-hidden="true" className="text-slate-300">
        &middot;
      </span>
      <span>{formatCisecoDate(locale, author.date)}</span>
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
        {t(eyebrow || "A.D.S")}
      </span>
      <span className="pointer-events-none absolute left-8 top-6 hidden h-5 w-20 rounded-full border border-white/40 sm:block" />
      <span className="pointer-events-none absolute right-10 top-8 hidden h-3 w-12 rounded-full border border-white/40 sm:block" />
      <span className="pointer-events-none absolute bottom-6 left-12 hidden h-3 w-12 rounded-full border border-white/40 sm:block" />
      {title || description ? (
        <div className="mt-4 space-y-2">
          {title ? (
            <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              {t(title)}
            </h3>
          ) : null}
          {description ? (
            <p className="mx-auto max-w-xl text-sm text-slate-700/80">
              {t(description)}
            </p>
          ) : null}
        </div>
      ) : null}
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
      <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="relative mx-auto w-full max-w-[280px] sm:max-w-none">
          <CatalogImage
            src={image ?? BLOG_IMAGES.kids}
            alt={t("Kid with skateboard")}
            className="h-full w-full object-contain"
            width={560}
            height={560}
            sizes="(min-width: 640px) 42vw, 280px"
            loading="lazy"
          />
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>{companyName}</span>
            <span className="text-[var(--site-accent)]">.</span>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {title ?? (
              <>
                {t("Special offer")}
                <br />
                {t("in kids products")}
              </>
            )}
          </h3>
          <p className="text-sm text-slate-500">
            {description
              ? t(description)
              : t(
                  "Fashion is a form of self-expression and autonomy at a particular period and place.",
                )}
          </p>
          <a
            href={buttonHref ?? "#"}
            className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm"
          >
            {buttonLabel ? t(buttonLabel) : t("Discover more")}
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
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 3.5c-3 0-5.5 2.4-5.5 5.4 0 4.1 4.7 9.3 5.1 9.8.2.2.5.2.7 0 .4-.5 5.1-5.7 5.1-9.8 0-3-2.5-5.4-5.4-5.4z"
        fill="currentColor"
      />
      <circle cx="12" cy="8.9" r="2" fill="white" />
    </svg>
  );
}
