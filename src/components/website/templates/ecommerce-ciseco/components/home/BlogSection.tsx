import type { CatalogPayload } from "@/server/website";
import { BLOG_POSTS } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { BlogPost, ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { resolveCisecoNavigationHref } from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { BlogCard } from "../shared/BlogCard";
import { Reveal } from "../shared/Reveal";
import { Section } from "../layout/Section";

type BlogSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
  homeHref: string;
  blogPosts?: CatalogPayload["blogPosts"];
};

function formatBlogDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildManagedSectionPosts(
  blogPosts: NonNullable<CatalogPayload["blogPosts"]>,
): BlogPost[] {
  return blogPosts.slice(0, 4).map((post, index) => ({
    id: post.id,
    title: post.title,
    excerpt:
      post.excerpt ??
      "Read the latest update from our editorial journal.",
    image: post.coverImageUrl ?? BLOG_POSTS[index % BLOG_POSTS.length]?.image ?? "",
    tag:
      post.category ??
      post.tags[0] ??
      (post.featured ? "Featured" : "Story"),
    date: formatBlogDate(post.publishDate),
    href: `/blog/${post.slug}`,
  }));
}

export function BlogSection({
  theme,
  section,
  mediaLibrary = [],
  homeHref,
  blogPosts,
}: BlogSectionProps) {
  const { t, localizeHref } = useCisecoI18n();
  const eyebrow = section?.eyebrow ?? "Latest updates";
  const title = section?.title ?? "Stories, notes, and ideas";
  const subtitle =
    section?.subtitle ??
    "Use this area for announcements, guides, or editorial content.";
  const posts =
    blogPosts !== undefined
      ? buildManagedSectionPosts(blogPosts)
      : section?.items?.length
        ? section.items.map((item, index) => {
            const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
            const fallback = BLOG_POSTS[index];
            return {
              id: item.id,
              title: item.title ?? fallback?.title ?? "Blog post",
              excerpt: item.description ?? fallback?.excerpt ?? "",
              image: asset?.src ?? fallback?.image ?? "",
              tag: item.tag ?? fallback?.tag ?? "Story",
              date: item.badge ?? fallback?.date ?? "",
              href: item.href ?? fallback?.href ?? "/blog",
            };
          })
        : BLOG_POSTS;

  const resolvedPosts = posts.map((post) => ({
    ...post,
    href: localizeHref(
      resolveCisecoNavigationHref({
        href: post.href,
        homeHref,
        fallbackPath: "/blog",
      }),
    ),
  }));
  const [featured, ...rest] = resolvedPosts;

  return (
    <Section
      theme={theme}
      id="blog"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section?.id}
      deferRendering
      containIntrinsicSize="1px 1120px"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="ciseco-home-eyebrow">
            {t(eyebrow)}
          </p>
          <h2 className="ciseco-home-title max-w-3xl text-[34px] sm:text-[42px]">
            {t(title)}
          </h2>
          <p className="ciseco-home-subtitle max-w-2xl">
            {t(subtitle)}
          </p>
        </div>

        {blogPosts !== undefined && resolvedPosts.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-black/10 bg-white/85 px-6 py-10 text-center shadow-[0_20px_60px_-48px_rgba(15,23,42,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--site-accent)]">
              {t("Blog")}
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {t("No articles published yet")}
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              {t("Published posts will appear here automatically as soon as the editorial team sends them live.")}
            </p>
          </div>
        ) : featured ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Reveal delay={40}>
              <BlogCard post={featured} />
            </Reveal>
            <div className="grid gap-4">
              {rest.map((post, index) => (
                <Reveal key={post.id} delay={60 + index * 60}>
                  <BlogCard post={post} variant="compact" />
                </Reveal>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
