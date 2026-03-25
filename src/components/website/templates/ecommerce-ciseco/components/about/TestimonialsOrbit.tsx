import clsx from "clsx";
import type { ThemeTokens } from "../../types";
import { Section } from "../layout/Section";

const ORBIT_POSITIONS = [
  "-left-6 top-10 hidden sm:block animate-[float_14s_ease-in-out_infinite]",
  "left-12 bottom-8 hidden sm:block animate-[float_12s_ease-in-out_infinite]",
  "right-8 top-6 hidden sm:block animate-[float_16s_ease-in-out_infinite]",
  "-right-6 bottom-12 hidden sm:block animate-[float_14s_ease-in-out_infinite]",
  "left-6 -bottom-6 hidden md:block animate-[float_12s_ease-in-out_infinite]",
  "right-24 -bottom-8 hidden md:block animate-[float_16s_ease-in-out_infinite]",
  "left-1/2 -top-8 hidden lg:block -translate-x-1/2 animate-[float_12s_ease-in-out_infinite]",
];

type OrbitAvatar = {
  id: string;
  image: string;
};

type Testimonial = {
  quote: string;
  name: string;
  rating: number;
  avatar: string;
};

type TestimonialsOrbitProps = {
  theme: ThemeTokens;
  title: string;
  subtitle: string;
  testimonial: Testimonial;
  avatars: OrbitAvatar[];
  sectionId?: string;
};

export function TestimonialsOrbit({
  theme,
  title,
  subtitle,
  testimonial,
  avatars,
  sectionId,
}: TestimonialsOrbitProps) {
  return (
    <Section theme={theme} id="testimonials" builderSectionId={sectionId}>
      <div className="space-y-10">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {title}
          </h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="relative mx-auto max-w-3xl pt-10">
          <div className="relative rounded-3xl border border-black/5 bg-white px-6 pb-8 pt-10 text-center shadow-sm sm:px-10">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
              <div className="h-16 w-16 overflow-hidden rounded-full border-4 border-white shadow-sm">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <span
              aria-hidden="true"
              className="absolute left-6 top-6 text-4xl text-slate-200"
            >
              &ldquo;
            </span>
            <span
              aria-hidden="true"
              className="absolute bottom-12 right-6 text-4xl text-slate-200"
            >
              &rdquo;
            </span>
            <p className="text-sm text-slate-700 sm:text-base">
              {testimonial.quote}
            </p>
            <p className="mt-4 text-sm font-semibold text-slate-900">
              {testimonial.name}
            </p>
            <div className="mt-2 flex items-center justify-center gap-1 text-amber-400">
              {Array.from({ length: testimonial.rating }).map((_, idx) => (
                <StarIcon key={`star-${idx}`} className="h-4 w-4" />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <span
                  key={`dot-${idx}`}
                  className={clsx(
                    "h-1.5 w-1.5 rounded-full",
                    idx === 1 ? "bg-slate-900" : "bg-slate-300",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0">
            {avatars.map((avatar, index) => (
              <div
                key={avatar.id}
                className={clsx(
                  "absolute h-10 w-10 overflow-hidden rounded-full border-4 border-white shadow-sm",
                  ORBIT_POSITIONS[index % ORBIT_POSITIONS.length],
                )}
              >
                <img
                  src={avatar.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

type IconProps = {
  className?: string;
};

function StarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}
