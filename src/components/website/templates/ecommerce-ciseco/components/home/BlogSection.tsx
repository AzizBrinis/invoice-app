import { BLOG_POSTS } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { BlogCard } from "../shared/BlogCard";
import { Reveal } from "../shared/Reveal";
import { Section } from "../layout/Section";

type BlogSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
};

export function BlogSection({
  theme,
  section,
  mediaLibrary = [],
}: BlogSectionProps) {
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
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-900">
            {eyebrow}
          </p>
          <h2 className="text-[30px] font-semibold leading-tight text-slate-900 sm:text-[34px]">
            {title}
          </h2>
          <p className="text-sm text-slate-500">
            {subtitle}
          </p>
        </div>
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
      </div>
    </Section>
  );
}
