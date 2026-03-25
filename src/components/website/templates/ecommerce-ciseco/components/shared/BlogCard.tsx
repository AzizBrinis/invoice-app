import type { BlogPost } from "../../types";

type BlogCardProps = {
  post: BlogPost;
  variant?: "large" | "compact";
};

export function BlogCard({ post, variant = "large" }: BlogCardProps) {
  if (variant === "compact") {
    return (
      <a
        href="#"
        className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <img
            src={post.image}
            alt={post.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600">
            {post.tag}
          </p>
          <p className="text-sm font-semibold text-slate-900">{post.title}</p>
          <p className="text-xs text-slate-500">{post.date}</p>
        </div>
      </a>
    );
  }

  return (
    <a
      href="#"
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img
          src={post.image}
          alt={post.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600">
          {post.tag}
        </p>
        <h3 className="text-lg font-semibold text-slate-900">{post.title}</h3>
        <p className="text-sm text-slate-500">{post.excerpt}</p>
        <span className="mt-auto text-xs font-semibold text-slate-500">
          {post.date}
        </span>
      </div>
    </a>
  );
}
