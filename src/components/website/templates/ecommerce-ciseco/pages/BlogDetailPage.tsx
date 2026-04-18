import clsx from "clsx";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { CatalogPayload } from "@/server/website";
import type { ThemeTokens } from "../types";
import {
  matchBlogCollections,
  matchBlogProducts,
  rankRelatedBlogPosts,
  toBlogClusterArticle,
} from "../blog-cluster";
import {
  resolveBuilderMedia,
  resolveBuilderSectionBySignature,
} from "../builder-helpers";
import { ExtraSections } from "../components/builder/ExtraSections";
import { CatalogImage } from "../components/shared/CatalogImage";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { Reveal } from "../components/shared/Reveal";
import { useCisecoI18n } from "../i18n";
import { formatCisecoDate } from "../locale";

type BlogDetailPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  baseLink: (target: string) => string;
  catalogSlug: string;
  mode: "public" | "preview";
  postSlug?: string;
  post: CatalogPayload["currentBlogPost"] | null;
  blogPosts?: CatalogPayload["blogPosts"];
  products?: CatalogPayload["products"];
  requiresClientPostData?: boolean;
  builder?: WebsiteBuilderPageConfig | null;
};

type BlogDetailStatus = "loading" | "error" | "ready" | "not-found";

const BLOG_DETAIL_CACHE = new Map<
  string,
  CatalogPayload["currentBlogPost"] | null
>();
const BLOG_DETAIL_REQUEST_CACHE = new Map<
  string,
  Promise<CatalogPayload["currentBlogPost"] | null>
>();
const EMPTY_CATALOG_PRODUCTS: CatalogPayload["products"]["all"] = [];

const LEGACY_POSTS: Record<string, NonNullable<CatalogPayload["currentBlogPost"]>> = {
  "graduation-dresses-style-guide": {
    id: "legacy-blog-1",
    title: "Graduation Dresses: A Style Guide",
    slug: "graduation-dresses-style-guide",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus unde.",
    coverImageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    socialImageUrl: null,
    category: "Editorial",
    tags: ["Style", "Guide"],
    authorName: "Scott Wolkowski",
    publishDate: "2025-09-30",
    featured: true,
    readingTimeMinutes: 5,
    wordCount: 880,
    metaTitle: null,
    metaDescription: null,
    bodyHtml: [
      "<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Illo vel voluptas ipsum placeat, ipsum quaerat neque doloribus eaque voluptate.</p>",
      "<h2 id=\"typography-should-be-easy\">Typography should be easy</h2>",
      "<p>So that’s another reason you’ll see why the UI doesn’t even come close to what we set out in this story.</p>",
      "<h3 id=\"code-should-look-okay\">Code should look okay by default</h3>",
      "<p>I think most people are going to use highlightjs or prism or something if they want to style their code blocks.</p>",
      "<blockquote><p>Editorial content should answer buyer questions before they become objections.</p></blockquote>",
      "<h2 id=\"closing-thoughts\">Closing thoughts</h2>",
      "<p>Let’s also add a closing paragraph here so this can act as a decent-sized block of text for the fallback article experience.</p>",
    ].join(""),
    headings: [
      { id: "typography-should-be-easy", text: "Typography should be easy", level: 2 },
      { id: "code-should-look-okay", text: "Code should look okay by default", level: 3 },
      { id: "closing-thoughts", text: "Closing thoughts", level: 2 },
    ],
  },
  "eid-pieces-all-year": {
    id: "legacy-blog-2",
    title: "How to Wear Your Eid Pieces All Year Long",
    slug: "eid-pieces-all-year",
    excerpt:
      "Practical styling notes and product pairing ideas for keeping seasonal pieces in daily rotation.",
    coverImageUrl:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80",
    socialImageUrl: null,
    category: "Guide",
    tags: ["Wardrobe", "Guide"],
    authorName: "Erica Alexander",
    publishDate: "2025-09-24",
    featured: false,
    readingTimeMinutes: 6,
    wordCount: 1040,
    metaTitle: null,
    metaDescription: null,
    bodyHtml: "<p>This is a legacy fallback article body used when no managed blog posts are configured yet.</p>",
    headings: [],
  },
  "hijabi-friendly-fabrics-2024": {
    id: "legacy-blog-3",
    title: "The Must-Have Hijabi Friendly Fabrics For 2024",
    slug: "hijabi-friendly-fabrics-2024",
    excerpt:
      "A quick overview of breathable fabrics, weight, drape, and layering choices for the season.",
    coverImageUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
    socialImageUrl: null,
    category: "Insight",
    tags: ["Textiles"],
    authorName: "Willie Edwards",
    publishDate: "2025-09-16",
    featured: false,
    readingTimeMinutes: 4,
    wordCount: 720,
    metaTitle: null,
    metaDescription: null,
    bodyHtml: "<p>This is a legacy fallback article body used when no managed blog posts are configured yet.</p>",
    headings: [],
  },
  "hijabi-friendly-fabrics-2025": {
    id: "legacy-blog-4",
    title: "The Hijabi Friendly Fabrics For 2025",
    slug: "hijabi-friendly-fabrics-2025",
    excerpt:
      "An updated editorial note on lightweight materials, texture, and new customer expectations.",
    coverImageUrl:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80",
    socialImageUrl: null,
    category: "Trend",
    tags: ["Trend"],
    authorName: "Alex Klein",
    publishDate: "2025-09-10",
    featured: false,
    readingTimeMinutes: 7,
    wordCount: 1210,
    metaTitle: null,
    metaDescription: null,
    bodyHtml: "<p>This is a legacy fallback article body used when no managed blog posts are configured yet.</p>",
    headings: [],
  },
};

async function loadBlogPostDetail(options: {
  catalogSlug: string;
  mode: "public" | "preview";
  postSlug: string;
}) {
  const cacheKey = `${options.mode}:${options.catalogSlug}:${options.postSlug}`;
  const cached = BLOG_DETAIL_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const inflight = BLOG_DETAIL_REQUEST_CACHE.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = fetch(
    `/api/catalogue/blog?slug=${encodeURIComponent(options.catalogSlug)}&mode=${encodeURIComponent(options.mode)}&post=${encodeURIComponent(options.postSlug)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  )
    .then(async (response) => {
      const result = (await response.json()) as {
        post?: CatalogPayload["currentBlogPost"] | null;
      };

      if (response.status === 404) {
        BLOG_DETAIL_CACHE.set(cacheKey, null);
        return null;
      }

      if (!response.ok) {
        throw new Error("Unable to load blog post.");
      }

      const post = result.post ?? null;
      BLOG_DETAIL_CACHE.set(cacheKey, post);
      return post;
    })
    .finally(() => {
      BLOG_DETAIL_REQUEST_CACHE.delete(cacheKey);
    });

  BLOG_DETAIL_REQUEST_CACHE.set(cacheKey, request);
  return request;
}

function buildInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function resolveReadTimeLabel(
  minutes: number | null | undefined,
  locale: "fr" | "en",
) {
  const value = Math.max(1, minutes ?? 1);
  return locale === "fr" ? `${value} min de lecture` : `${value} min read`;
}

function resolveFallbackPost(
  postSlug: string | undefined,
  blogPosts: CatalogPayload["blogPosts"] | undefined,
) {
  if (blogPosts !== undefined) {
    return null;
  }
  if (!postSlug) {
    return null;
  }
  return LEGACY_POSTS[postSlug] ?? null;
}

export function BlogDetailPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  baseLink,
  catalogSlug,
  mode,
  postSlug,
  post,
  blogPosts,
  products,
  requiresClientPostData = false,
  builder,
}: BlogDetailPageProps) {
  const { localizeHref, t, locale } = useCisecoI18n();
  const container = clsx("mx-auto px-6 sm:px-8", theme.containerClass);
  const hasBuilder = Boolean(builder);
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-blog-detail-hero",
    type: "hero",
    layouts: ["page-hero", "split"],
  });
  const relatedSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-blog-detail-related",
    type: "content",
    layouts: "blog-related",
  });
  const bodySection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-blog-detail-body",
    type: "content",
    layouts: "blog-body",
  });
  const cacheKey = postSlug ? `${mode}:${catalogSlug}:${postSlug}` : null;
  const fallbackPost = resolveFallbackPost(postSlug, blogPosts);
  const initialPost =
    postSlug && post?.slug === postSlug
      ? post
      : fallbackPost ?? (cacheKey ? BLOG_DETAIL_CACHE.get(cacheKey) ?? null : null);
  const [clientPost, setClientPost] = useState<CatalogPayload["currentBlogPost"] | null>(
    () => initialPost,
  );
  const [status, setStatus] = useState<BlogDetailStatus>(() => {
    if (initialPost) {
      return "ready";
    }
    if (!postSlug) {
      return "not-found";
    }
    if (fallbackPost) {
      return "ready";
    }
    if (cacheKey && BLOG_DETAIL_CACHE.has(cacheKey)) {
      return BLOG_DETAIL_CACHE.get(cacheKey) ? "ready" : "not-found";
    }
    return requiresClientPostData ? "loading" : "not-found";
  });

  useEffect(() => {
    if (postSlug && post?.slug === postSlug) {
      BLOG_DETAIL_CACHE.set(`${mode}:${catalogSlug}:${postSlug}`, post);
      return;
    }
    if (fallbackPost) {
      return;
    }
    if (
      !requiresClientPostData ||
      !postSlug ||
      !cacheKey ||
      BLOG_DETAIL_CACHE.has(cacheKey)
    ) {
      return;
    }

    let cancelled = false;

    void loadBlogPostDetail({
      catalogSlug,
      mode,
      postSlug,
    })
      .then((nextPost) => {
        if (cancelled) {
          return;
        }
        setClientPost(nextPost);
        setStatus(nextPost ? "ready" : "not-found");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setClientPost(null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [
    cacheKey,
    catalogSlug,
    fallbackPost,
    mode,
    post,
    postSlug,
    requiresClientPostData,
  ]);

  const resolvedPost = postSlug && post?.slug === postSlug ? post : clientPost;
  const relatedPosts = useMemo(() => {
    if (blogPosts !== undefined) {
      if (!resolvedPost) {
        return (blogPosts ?? []).slice(0, 4);
      }
      return rankRelatedBlogPosts(
        toBlogClusterArticle(resolvedPost),
        (blogPosts ?? []).map(toBlogClusterArticle),
      )
        .slice(0, 4)
        .map((entry) => (blogPosts ?? []).find((post) => post.slug === entry.slug))
        .filter(
          (entry): entry is NonNullable<CatalogPayload["blogPosts"]>[number] =>
            Boolean(entry),
        );
    }
    const legacyPosts = Object.values(LEGACY_POSTS);
    const currentLegacyPost =
      resolvedPost && "bodyHtml" in resolvedPost
        ? {
            ...resolvedPost,
            tags: resolvedPost.tags ?? [],
          }
        : null;
    return (currentLegacyPost
      ? rankRelatedBlogPosts(
          toBlogClusterArticle(currentLegacyPost),
          legacyPosts.map(toBlogClusterArticle),
        )
      : legacyPosts.map(toBlogClusterArticle)
    )
      .slice(0, 4)
      .map((entry) => legacyPosts.find((post) => post.slug === entry.slug))
      .filter((entry): entry is (typeof legacyPosts)[number] => Boolean(entry))
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        slug: entry.slug,
        excerpt: entry.excerpt,
        coverImageUrl: entry.coverImageUrl,
        socialImageUrl: entry.socialImageUrl,
        category: entry.category,
        tags: entry.tags,
        authorName: entry.authorName,
        publishDate: entry.publishDate,
        featured: entry.featured,
        readingTimeMinutes: entry.readingTimeMinutes,
        wordCount: entry.wordCount,
        metaTitle: entry.metaTitle,
        metaDescription: entry.metaDescription,
      }));
  }, [blogPosts, resolvedPost]);
  const catalogProducts = products?.all ?? EMPTY_CATALOG_PRODUCTS;
  const researchCollections = useMemo(() => {
    if (!resolvedPost) {
      return [];
    }
    return matchBlogCollections(toBlogClusterArticle(resolvedPost), catalogProducts, 2);
  }, [catalogProducts, resolvedPost]);
  const researchProducts = useMemo(() => {
    if (!resolvedPost) {
      return [];
    }
    return matchBlogProducts(toBlogClusterArticle(resolvedPost), catalogProducts, 3);
  }, [catalogProducts, resolvedPost]);
  const heroImage =
    resolvedPost?.coverImageUrl ??
    resolveBuilderMedia(heroSection?.mediaId, mediaLibrary)?.src ??
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80";
  const consumedIds = new Set(
    [heroSection, relatedSection, bodySection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) => section.visible !== false && !consumedIds.has(section.id),
  );
  const contactHref = baseLink("/contact");
  const blogHref = baseLink("/blog");

  useEffect(() => {
    if (status === "error") {
      console.error("[ciseco-blog] Failed to load blog post.", {
        postSlug,
      });
    }
  }, [postSlug, status]);

  if (status === "loading") {
    return (
      <PageShell inlineStyles={inlineStyles}>
        <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
        <main className="pb-14 pt-8 sm:pb-16 sm:pt-10">
          <div className={clsx(container, "space-y-6")}>
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="h-3 w-28 animate-pulse rounded-full bg-slate-100" />
              <div className="h-12 w-full max-w-2xl animate-pulse rounded-full bg-slate-200" />
              <div className="h-5 w-full animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="mx-auto aspect-[16/9] max-w-5xl animate-pulse rounded-[32px] bg-slate-100" />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
              <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-[0_20px_70px_-50px_rgba(15,23,42,0.42)] sm:p-10">
                <div className="space-y-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={`blog-loading-line-${index + 1}`}
                      className={clsx(
                        "h-4 animate-pulse rounded-full bg-slate-100",
                        index % 3 === 0 ? "w-full" : index % 3 === 1 ? "w-11/12" : "w-4/5",
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_16px_50px_-44px_rgba(15,23,42,0.45)]">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-slate-100" />
                  <div className="mt-4 space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={`blog-loading-nav-${index + 1}`}
                        className="h-10 animate-pulse rounded-2xl bg-slate-100"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
      </PageShell>
    );
  }

  if (status === "error") {
    return (
      <StateMessage
        theme={theme}
        inlineStyles={inlineStyles}
        companyName={companyName}
        homeHref={homeHref}
        title={t("Something went wrong")}
        description={t("We could not load this article right now. Please try again.")}
        href={blogHref}
        hrefLabel={t("Back to the blog")}
      />
    );
  }

  if (!resolvedPost) {
    return (
      <StateMessage
        theme={theme}
        inlineStyles={inlineStyles}
        companyName={companyName}
        homeHref={homeHref}
        title={t("Article not found")}
        description={t("This article is unavailable or has not been published yet.")}
        href={blogHref}
        hrefLabel={t("Back to the blog")}
      />
    );
  }

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main className="pb-14 sm:pb-16">
        <div className={clsx(container, "pt-8 sm:pt-10 lg:pt-12")}>
          <Reveal>
            <section
              className="mx-auto max-w-3xl space-y-5"
              data-builder-section={heroSection?.id}
            >
              <span className="inline-flex rounded-full bg-[color:var(--site-accent-soft,#eef8f4)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-accent)]">
                {t(resolvedPost.category ?? heroSection?.eyebrow ?? "Article")}
              </span>
              <h1 className="font-[family:var(--ciseco-font-display)] text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-[3.35rem] lg:leading-[1.02]">
                {resolvedPost.title}
              </h1>
              {resolvedPost.excerpt ? (
                <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                  {resolvedPost.excerpt}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <AuthorAvatar name={resolvedPost.authorName} />
                <span className="font-semibold text-slate-800">
                  {resolvedPost.authorName}
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  &middot;
                </span>
                <span>{formatCisecoDate(locale, resolvedPost.publishDate ?? new Date())}</span>
                <span aria-hidden="true" className="text-slate-300">
                  &middot;
                </span>
                <span>{resolveReadTimeLabel(resolvedPost.readingTimeMinutes, locale)}</span>
              </div>
            </section>
          </Reveal>
        </div>

        <div className={clsx(container, "mt-6 sm:mt-8")}>
          <Reveal delay={80}>
            <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] bg-slate-100 shadow-[0_26px_90px_-58px_rgba(15,23,42,0.42)]">
              <div className="relative aspect-[16/9] w-full">
                <CatalogImage
                  src={heroImage}
                  alt={resolvedPost.title}
                  className="h-full w-full object-cover"
                  sizes="(min-width: 1280px) 1180px, (min-width: 1024px) 92vw, 100vw"
                  priority
                  fill
                />
              </div>
            </div>
          </Reveal>
        </div>

        <div className={clsx("mx-auto mt-8 grid gap-6 px-4 sm:px-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:px-8", theme.containerClass)}>
          <Reveal delay={120} className="space-y-4 lg:order-2 lg:sticky lg:top-24">
            {resolvedPost.headings.length ? (
              <aside className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_16px_50px_-44px_rgba(15,23,42,0.45)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t("Table of contents")}
                </p>
                <nav className="mt-4 space-y-2">
                  {resolvedPost.headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className={clsx(
                        "block rounded-2xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900",
                        heading.level === 3 ? "ml-3" : null,
                        heading.level === 4 ? "ml-6 text-[13px]" : null,
                      )}
                    >
                      {heading.text}
                    </a>
                  ))}
                </nav>
              </aside>
            ) : null}

            {resolvedPost.tags.length ? (
              <aside className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_16px_50px_-44px_rgba(15,23,42,0.45)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t("Tags")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {resolvedPost.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </aside>
            ) : null}

            <aside className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_16px_50px_-44px_rgba(15,23,42,0.45)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t("Need help?")}
              </p>
              <h2 className="mt-3 font-[family:var(--ciseco-font-display)] text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {t("Speak with")} {companyName}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {t("For order questions, delivery details, payments or support, contact the store directly.")}
              </p>
              <a
                href={localizeHref(contactHref)}
                className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {t("Contact us")}
              </a>
            </aside>
          </Reveal>

          <Reveal className="min-w-0 lg:order-1">
            <article className="overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-[0_20px_70px_-50px_rgba(15,23,42,0.42)]">
              <div className="border-b border-black/5 px-6 py-4 sm:px-10">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t(bodySection?.eyebrow ?? "Reading page")}
                </p>
              </div>
              <div className="px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
                {bodySection?.description && resolvedPost.excerpt !== bodySection.description ? (
                  <p className="mb-6 text-sm leading-7 text-slate-500">
                    {t(bodySection.description)}
                  </p>
                ) : null}
                <div
                  className={clsx(
                    "text-[15px] leading-8 text-slate-600 sm:text-base",
                    "[&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-slate-300 [&_a]:underline-offset-4",
                    "[&_blockquote]:my-8 [&_blockquote]:rounded-[28px] [&_blockquote]:border [&_blockquote]:border-black/5 [&_blockquote]:bg-slate-50 [&_blockquote]:px-5 [&_blockquote]:py-5 [&_blockquote]:text-slate-700",
                    "[&_blockquote_p]:m-0",
                    "[&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_code]:text-slate-800",
                    "[&_hr]:my-10 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-black/6",
                    "[&_img]:my-8 [&_img]:rounded-[28px]",
                    "[&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:font-[family:var(--ciseco-font-display)] [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h2]:text-slate-950 sm:[&_h2]:text-[2rem]",
                    "[&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:font-[family:var(--ciseco-font-display)] [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-[-0.02em] [&_h3]:text-slate-900",
                    "[&_h4]:mt-7 [&_h4]:scroll-mt-24 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-slate-900",
                    "[&_ol]:my-6 [&_ol]:space-y-3 [&_ol]:pl-5",
                    "[&_p]:my-5 [&_p]:max-w-none",
                    "[&_strong]:font-semibold [&_strong]:text-slate-950",
                    "[&_table]:my-8 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-2xl",
                    "[&_td]:border [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-3",
                    "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900",
                    "[&_ul]:my-6 [&_ul]:space-y-3 [&_ul]:pl-5",
                    "[&_li]:pl-1",
                  )}
                  dangerouslySetInnerHTML={{ __html: resolvedPost.bodyHtml }}
                />
                {(researchCollections.length || researchProducts.length) ? (
                  <div className="mt-10 rounded-[28px] border border-black/5 bg-slate-50 px-5 py-6 sm:px-6">
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-accent)]">
                          {t("Continue your research")}
                        </p>
                        <h2 className="font-[family:var(--ciseco-font-display)] text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                          {t("Explore matching guides, collections, and licences")}
                        </h2>
                      </div>

                      {researchCollections.length ? (
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {t("Collections")}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {researchCollections.map((collection) => (
                              <a
                                key={collection.slug}
                                href={localizeHref(baseLink(`/collections/${collection.slug}`))}
                                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                              >
                                {collection.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {researchProducts.length ? (
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {t("Recommended licences")}
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {researchProducts.map((product) => (
                              <a
                                key={product.id}
                                href={localizeHref(baseLink(`/produit/${product.publicSlug}`))}
                                className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300 hover:shadow-[0_16px_36px_-30px_rgba(15,23,42,0.4)]"
                              >
                                <p className="text-sm font-semibold text-slate-950">
                                  {product.name}
                                </p>
                                {product.category ? (
                                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                    {product.category}
                                  </p>
                                ) : null}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <a
                        href={localizeHref(blogHref)}
                        className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        {t("Browse all guides")}
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          </Reveal>
        </div>

        {((Boolean(relatedSection) || !hasBuilder) && relatedPosts.length > 0) ? (
          <section className={clsx(container, "mt-12 sm:mt-14")} data-builder-section={relatedSection?.id}>
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {t(relatedSection?.title ?? "Related posts")}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {relatedPosts.map((relatedPost, index) => (
                  <Reveal key={relatedPost.id} delay={80 + index * 40}>
                    <RelatedPostCard
                      post={relatedPost}
                      href={baseLink(`/blog/${relatedPost.slug}`)}
                    />
                  </Reveal>
                ))}
              </div>
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

function AuthorAvatar({ name }: { name: string }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-[11px] font-semibold text-white">
      {buildInitials(name)}
    </span>
  );
}

function StateMessage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  title,
  description,
  href,
  hrefLabel,
}: {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
}) {
  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main className="pb-14 pt-10 sm:pb-16 sm:pt-14">
        <div className={clsx("mx-auto px-4 sm:px-6 lg:px-8", theme.containerClass)}>
          <section className="mx-auto max-w-2xl rounded-[32px] border border-black/5 bg-white px-6 py-10 text-center shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)] sm:px-8">
            <h1 className="font-[family:var(--ciseco-font-display)] text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              {description}
            </p>
            <a
              href={href}
              className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {hrefLabel}
            </a>
          </section>
        </div>
      </main>
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}

function RelatedPostCard({
  post,
  href,
}: {
  post: NonNullable<CatalogPayload["blogPosts"]>[number];
  href: string;
}) {
  const { locale, t } = useCisecoI18n();

  return (
    <a href={href} className="group block">
      <article className="space-y-3 transition hover:-translate-y-1">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-slate-100 shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
          <CatalogImage
            src={
              post.coverImageUrl ??
              "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80"
            }
            alt={post.title}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 46vw, 92vw"
            loading="lazy"
            fill
          />
        </div>
        <div className="space-y-2">
          {post.category ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--site-accent)]">
              {t(post.category)}
            </p>
          ) : null}
          <h3 className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-950">
            {post.title}
          </h3>
          {post.excerpt ? (
            <p className="text-xs leading-6 text-slate-500">{post.excerpt}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{post.authorName}</span>
            <span aria-hidden="true" className="text-slate-300">
              &middot;
            </span>
            <span>{formatCisecoDate(locale, post.publishDate ?? new Date())}</span>
          </div>
        </div>
      </article>
    </a>
  );
}
