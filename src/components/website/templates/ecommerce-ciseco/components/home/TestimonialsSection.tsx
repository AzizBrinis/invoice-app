import clsx from "clsx";
import { TESTIMONIALS } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { Section } from "../layout/Section";

type TestimonialsSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
};

export function TestimonialsSection({
  theme,
  section,
  mediaLibrary = [],
}: TestimonialsSectionProps) {
  const eyebrow = section?.eyebrow ?? "Good news from far away";
  const title = section?.title ?? "People love our products";
  const subtitle =
    section?.subtitle ?? "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
  const testimonials =
    section?.items?.length
      ? section.items.map((item, index) => {
          const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
          const fallback = TESTIMONIALS[index];
          return {
            id: item.id,
            quote: item.description ?? fallback?.quote ?? "",
            name: item.title ?? fallback?.name ?? "Customer",
            role: item.tag ?? fallback?.role ?? "",
            rating: fallback?.rating ?? 4.8,
            avatar: asset?.src ?? fallback?.avatar ?? "",
          };
        })
      : TESTIMONIALS;
  const [featured] = testimonials;
  const avatars = testimonials.slice(0, 6).map((item) => item.avatar);

  return (
    <Section
      theme={theme}
      id="testimonials"
      className="py-10 sm:py-12"
      builderSectionId={section?.id}
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center">
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
        <div className="relative mx-auto max-w-3xl">
          <div className="rounded-3xl bg-white/40 p-6 text-center sm:p-8">
            <div className="flex items-center justify-center gap-1 text-amber-500">
              {Array.from({ length: 5 }).map((_, index) => (
                <svg
                  key={`star-${index}`}
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
                    fill="currentColor"
                  />
                </svg>
              ))}
            </div>
            <p className="mt-4 text-[22px] leading-relaxed text-slate-700">
              &ldquo;{featured.quote}&rdquo;
            </p>
            <div className="mt-5 text-sm font-semibold text-slate-900">
              {featured.name}
            </div>
            <div className="text-xs text-slate-500">{featured.role}</div>
            <div className="mt-1 text-xs font-semibold text-slate-700">
              {featured.rating.toFixed(1)}
            </div>
          </div>
          <div className="pointer-events-none hidden sm:block">
            {avatars.map((avatar, index) => (
              <img
                key={`${avatar}-${index}`}
                src={avatar}
                alt=""
                className={clsx(
                  "absolute h-10 w-10 rounded-full border-4 border-white object-cover shadow-sm",
                  index === 0 && "-left-2 top-8",
                  index === 1 && "left-10 -bottom-2",
                  index === 2 && "right-12 -bottom-3",
                  index === 3 && "-right-2 top-9",
                  index === 4 && "left-20 -top-2",
                  index === 5 && "right-24 -top-3",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
