import type { BlogPost } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { CatalogImage } from "./CatalogImage";

type BlogCardProps = {
  post: BlogPost;
  variant?: "large" | "compact";
};

export function BlogCard({ post, variant = "large" }: BlogCardProps) {
  const { t, localizeHref } = useCisecoI18n();
  const href = localizeHref(post.href ?? "/blog");
  const title = t(post.title);
  const tag = t(post.tag);
  const date = t(post.date);
  const excerpt = t(post.excerpt);

  if (variant === "compact") {
    return (
      <a
        href={href}
        className="group flex items-center gap-3 rounded-[24px] border border-black/5 bg-white/95 p-3 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.42)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-black/10 hover:shadow-[0_24px_52px_-32px_rgba(15,23,42,0.42)]"
      >
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <CatalogImage
            src={post.image}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            sizes="80px"
            loading="lazy"
            fill
          />
        </div>
        <div className="space-y-1.5">
          <p className="ciseco-home-eyebrow text-[0.66rem] text-[var(--site-accent)]">
            {tag}
          </p>
          <p className="ciseco-card-title text-[15px] leading-[1.28] text-slate-900 transition-colors duration-200 group-hover:text-slate-700">
            {title}
          </p>
          <p className="text-[12px] font-medium tracking-[0.01em] text-slate-500">
            {date}
          </p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white/95 shadow-[0_22px_54px_-38px_rgba(15,23,42,0.46)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-black/10 hover:shadow-[0_28px_60px_-34px_rgba(15,23,42,0.45)]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <CatalogImage
          src={post.image}
          alt={title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 94vw"
          loading="lazy"
          fill
        />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5 sm:p-6">
        <p className="ciseco-home-eyebrow text-[0.68rem] text-[var(--site-accent)]">
          {tag}
        </p>
        <h3 className="ciseco-card-title text-[21px] leading-[1.16] text-slate-950 transition-colors duration-200 group-hover:text-slate-700">
          {title}
        </h3>
        <p className="text-[15px] leading-7 text-slate-500">{excerpt}</p>
        <span className="mt-auto text-[12px] font-semibold tracking-[0.01em] text-slate-500">
          {date}
        </span>
      </div>
    </a>
  );
}
