import clsx from "clsx";
import type { CSSProperties } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import {
  resolveBuilderMedia,
  resolveBuilderSectionBySignature,
} from "../builder-helpers";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useCisecoI18n } from "../i18n";
import { formatCisecoDate } from "../locale";

type BlogDetailPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  baseLink: (target: string) => string;
  builder?: WebsiteBuilderPageConfig | null;
};

type Author = {
  name: string;
  avatar: string;
  date: string;
  readTime: string;
};

type RelatedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  author: Author;
};

const ARTICLE_AUTHOR: Author = {
  name: "Scott Wolkowski",
  avatar:
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80",
  date: "Mar 18, 2020",
  readTime: "5 min read",
};

const ARTICLE_IMAGE =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80";

const RELATED_POSTS: RelatedPost[] = [
  {
    id: "related-graduation",
    slug: "graduation-dresses-style-guide",
    title: "Graduation Dresses: A Style Guide",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo.",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    author: ARTICLE_AUTHOR,
  },
  {
    id: "related-eid",
    slug: "eid-pieces-all-year",
    title: "How to Wear Your Eid Pieces All Year Long",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo.",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
    author: {
      name: "Erica Alexander",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
      date: "Mar 16, 2020",
      readTime: "6 min read",
    },
  },
  {
    id: "related-hijabi-2024",
    slug: "hijabi-friendly-fabrics-2024",
    title: "The Must-Have Hijabi Friendly Fabrics for 2024",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo.",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    author: {
      name: "Willie Edwards",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
      date: "Mar 16, 2020",
      readTime: "6 min read",
    },
  },
  {
    id: "related-hijabi-2025",
    slug: "hijabi-friendly-fabrics-2025",
    title: "The Hijabi Friendly Fabrics for 2025",
    excerpt:
      "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo.",
    image:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80",
    author: {
      name: "Alex Klein",
      avatar:
        "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=120&q=80",
      date: "Mar 16, 2020",
      readTime: "6 min read",
    },
  },
];

const TAGS = ["Fashion (2)", "Style (4)", "Photography (8)", "Travel (12)"];

const SOCIAL_LINKS = [
  {
    id: "facebook",
    label: "Facebook",
    className: "text-blue-600",
    path: "M13.5 8.5h2.8V6h-2.4C12 6 11 7 11 8.9V11H9v2.5h2V20h2.5v-6.5h2.2l.3-2.5h-2.5V9c0-.3.2-.5.5-.5z",
  },
  {
    id: "twitter",
    label: "Twitter",
    className: "text-sky-500",
    path: "M19.5 7.2a6 6 0 0 1-1.8.5 3.1 3.1 0 0 0 1.4-1.7 6 6 0 0 1-2 .8 3 3 0 0 0-5.2 2c0 .2 0 .5.1.7A8.5 8.5 0 0 1 6 6.5a3 3 0 0 0 .9 4 3 3 0 0 1-1.4-.4v.1c0 1.4 1 2.7 2.4 3a3 3 0 0 1-1.4.1c.4 1.2 1.5 2 2.9 2a6.1 6.1 0 0 1-3.7 1.3h-.7A8.7 8.7 0 0 0 10 19c5.7 0 8.8-4.8 8.8-8.8v-.4c.6-.4 1.2-1 1.6-1.6z",
  },
  {
    id: "instagram",
    label: "Instagram",
    className: "text-rose-500",
    path: "M7.5 4h9A3.5 3.5 0 0 1 20 7.5v9A3.5 3.5 0 0 1 16.5 20h-9A3.5 3.5 0 0 1 4 16.5v-9A3.5 3.5 0 0 1 7.5 4zm4.5 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm5-2.4a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    className: "text-slate-700",
    path: "M6.5 9.5H4V20h2.5V9.5zm9 0h-2.4v1.4h-.1c-.3-.6-1.2-1.6-2.7-1.6-2.9 0-3.4 2-3.4 4.5V20H10v-5.3c0-1.3 0-3 1.8-3 1.8 0 2.1 1.4 2.1 2.9V20h2.6v-6.1c0-3.3-.7-4.4-2.9-4.4zM5.3 8.2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
  },
];

export function BlogDetailPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  baseLink,
  builder,
}: BlogDetailPageProps) {
  const { t } = useCisecoI18n();
  const container = clsx("mx-auto px-6 sm:px-8", theme.containerClass);
  const blogHref = (slug: string) => baseLink(`/blog/${slug}`);
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
  const heroImage = resolveBuilderMedia(heroSection?.mediaId, mediaLibrary);
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;
  const showHero = Boolean(heroSection) || !hasBuilder;
  const showBody = Boolean(bodySection) || !hasBuilder;
  const showRelated = Boolean(relatedSection) || !hasBuilder;
  const bodyIntro =
    bodySection?.description ??
    (!hasBuilder
      ? "Lorem ipsum dolor sit amet consectetur adipisicing elit. Illo vel voluptas ipsum placeat, ipsum quaerat neque doloribus eaque voluptate."
      : null);
  const bodyBlocks =
    bodySection?.items?.length
      ? bodySection.items
      : !hasBuilder
        ? [
            {
              id: "fallback-body-1",
              title: "Typography should be easy",
              description:
                "So that’s another reason you’ll see why the UI doesn’t even come close to what we set out in this story.",
              stats: [],
            },
            {
              id: "fallback-body-2",
              title: "Code should look okay by default.",
              description:
                "I think most people are going to use highlightjs or prism or something if they want to style their code blocks.",
              stats: [],
            },
            {
              id: "fallback-body-3",
              title: "We still need to think about stacked headings though.",
              description:
                "Let’s also add a closing paragraph here so this can act as a decent sized block of text.",
              stats: [],
            },
          ]
        : [];
  const relatedPosts =
    relatedSection?.items?.length
      ? relatedSection.items.map((item, index) => {
          const fallback = RELATED_POSTS[index];
          const media = resolveBuilderMedia(item.mediaId, mediaLibrary);
          return {
            id: item.id,
            slug: item.href ?? fallback?.slug ?? "blog",
            title: item.title ?? fallback?.title ?? "Related post",
            excerpt: item.description ?? fallback?.excerpt ?? "",
            image: media?.src ?? fallback?.image ?? "",
            author: fallback?.author ?? ARTICLE_AUTHOR,
          } satisfies RelatedPost;
        })
      : RELATED_POSTS;
  const consumedIds = new Set(
    [heroSection, relatedSection, bodySection]
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
        {showHero ? (
          <section className={clsx(container, "pt-8 sm:pt-10 lg:pt-12")}>
            <div
              className="mx-auto max-w-3xl space-y-5"
              data-builder-section={heroSection?.id}
            >
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                {t(heroSection?.eyebrow ?? "Marketing")}
              </span>
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl lg:text-4xl">
                {t(heroSection?.title ?? "Graduation Dresses: A Style Guide")}
              </h1>
              <p className="text-sm text-slate-500 sm:text-base">
                {t(
                  heroSubtitle ??
                    "Illo sint voluptates. Error voluptates culpa eligendi. Hic vel totam vitae illo. Non aliquid explicabo necessitatibus unde. Sed consequatur dolorem quisquam commodi dolores.",
                )}
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <AuthorMeta author={ARTICLE_AUTHOR} />
                <div className="flex items-center gap-3">
                  {SOCIAL_LINKS.map((item) => (
                    <a
                      key={item.id}
                      href="#"
                      aria-label={t(item.label)}
                      className={clsx(
                        "flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                        item.className,
                      )}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path d={item.path} fill="currentColor" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {showHero ? (
          <section className={clsx(container, "mt-6 sm:mt-8")}>
            <div className="mx-auto max-w-4xl">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[32px] bg-slate-100 shadow-sm">
                <img
                  src={heroImage?.src ?? ARTICLE_IMAGE}
                  alt={t(heroImage?.alt ?? "Directional signposts")}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </section>
        ) : null}

        {showBody ? (
          <section
            className={clsx(container, "mt-8 sm:mt-10")}
            data-builder-section={bodySection?.id}
          >
            <article className="mx-auto max-w-3xl space-y-6 text-sm text-slate-600">
              {bodyIntro ? <p>{t(bodyIntro)}</p> : null}
              {bodyBlocks.map((item) => (
                <div key={item.id} className="space-y-3">
                  {item.title ? (
                    <h2 className="text-base font-semibold text-slate-900">
                      {t(item.title)}
                    </h2>
                  ) : null}
                  {item.description ? <p>{t(item.description)}</p> : null}
                </div>
              ))}
              <div className="flex flex-wrap gap-2 border-t border-black/5 pt-4 text-xs text-slate-500">
                {TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-500"
                  >
                    {t(tag)}
                  </span>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        <section className={clsx(container, "mt-8 sm:mt-10")}>
          <div className="mx-auto max-w-4xl">
            <AuthorBio author={ARTICLE_AUTHOR} />
          </div>
        </section>

        <section className={clsx(container, "mt-8 sm:mt-10")}>
          <div className="mx-auto max-w-3xl space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {t("Comments")} (14)
            </h3>
            <div className="rounded-2xl border border-black/5 bg-white p-4">
              <textarea
                className="h-32 w-full resize-none text-sm text-slate-600 outline-none placeholder:text-slate-400"
                placeholder={t("Write a comment...")}
              />
            </div>
            <button
              type="button"
              className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white"
            >
              {t("Submit the comment")}
            </button>
          </div>
        </section>

        {showRelated ? (
          <section
            className={clsx(container, "mt-12 sm:mt-14")}
            data-builder-section={relatedSection?.id}
          >
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">
                {t(relatedSection?.title ?? "Related posts")}
              </h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {relatedPosts.map((post) => (
                  <RelatedPostCard key={post.id} post={post} href={blogHref(post.slug)} />
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

type AuthorMetaProps = {
  author: Author;
  variant?: "default" | "compact";
  showReadTime?: boolean;
};

function AuthorMeta({
  author,
  variant = "default",
  showReadTime = true,
}: AuthorMetaProps) {
  const { t, locale } = useCisecoI18n();
  const isCompact = variant === "compact";

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-2 text-slate-500",
        isCompact ? "text-[11px]" : "text-xs",
      )}
    >
      <img
        src={author.avatar}
        alt={author.name}
        className={clsx(
          "rounded-full object-cover",
          isCompact ? "h-5 w-5" : "h-7 w-7",
        )}
        loading="lazy"
      />
      <span className="font-semibold text-slate-700">{author.name}</span>
      <span className="text-slate-300" aria-hidden="true">
        &middot;
      </span>
      <span>{formatCisecoDate(locale, author.date)}</span>
      {showReadTime && (
        <>
          <span className="text-slate-300" aria-hidden="true">
            &middot;
          </span>
          <span>{t(author.readTime)}</span>
        </>
      )}
    </div>
  );
}

type AuthorBioProps = {
  author: Author;
};

function AuthorBio({ author }: AuthorBioProps) {
  const { t } = useCisecoI18n();

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
      <img
        src={author.avatar}
        alt={author.name}
        className="h-14 w-14 rounded-full object-cover"
        loading="lazy"
      />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">{author.name}</p>
        <p className="text-sm text-slate-500">
          {t(
            "Scott is an editorial designer and copywriter with over 10 years of experience. He loves crafting unique and human-centered experiences.",
          )}
        </p>
      </div>
    </div>
  );
}

type RelatedPostCardProps = {
  post: RelatedPost;
  href: string;
};

function RelatedPostCard({ post, href }: RelatedPostCardProps) {
  const { t } = useCisecoI18n();

  return (
    <a href={href} className="group block">
      <article className="space-y-3 transition hover:-translate-y-1">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-slate-100 shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
          <img
            src={post.image}
            alt={post.title}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-950">
            {t(post.title)}
          </h4>
          <p className="text-xs text-slate-500">{t(post.excerpt)}</p>
          <AuthorMeta author={post.author} variant="compact" showReadTime={false} />
        </div>
      </article>
    </a>
  );
}
