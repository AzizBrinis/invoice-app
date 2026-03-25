import clsx from "clsx";
import type { ReactNode } from "react";
import type { ThemeTokens } from "../../types";

type SectionProps = {
  theme: ThemeTokens;
  id?: string;
  className?: string;
  builderSectionId?: string;
  children: ReactNode;
};

export function Section({
  theme,
  id,
  className,
  builderSectionId,
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      data-builder-section={builderSectionId}
      className={clsx(theme.sectionSpacing, className)}
    >
      <div
        className={clsx(
          "mx-auto w-full px-4 sm:px-6 lg:px-8",
          theme.containerClass,
        )}
      >
        {children}
      </div>
    </section>
  );
}
