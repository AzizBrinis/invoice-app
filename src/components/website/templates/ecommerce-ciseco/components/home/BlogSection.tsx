import { BLOG_POSTS } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
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
};

export function BlogSection({
  theme,
  section,
  mediaLibrary = [],
  homeHref,
}: BlogSectionProps) {
  const { t, localizeHref } = useCisecoI18n();
  const eyebrow = section?.eyebrow ?? "Latest updates";
  const title = section?.title ?? "Stories, notes, and ideas";
  const subtitle =
    section?.subtitle ??
    "Use this area for announcements, guides, or editorial content.";
  const posts =
    section?.items?.length
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
  const [featured, ...rest] = posts;

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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Reveal delay={40}>
            <BlogCard
              post={{
                ...featured,
                href: localizeHref(
                  resolveCisecoNavigationHref({
                    href: featured?.href,
                    homeHref,
                    fallbackPath: "/blog",
                  }),
                ),
              }}
            />
          </Reveal>
          <div className="grid gap-4">
            {rest.map((post, index) => (
              <Reveal key={post.id} delay={60 + index * 60}>
                <BlogCard
                  post={{
                    ...post,
                    href: localizeHref(
                      resolveCisecoNavigationHref({
                        href: post.href,
                        homeHref,
                        fallbackPath: "/blog",
                      }),
                    ),
                  }}
                  variant="compact"
                />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
