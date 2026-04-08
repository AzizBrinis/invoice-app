import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import type { ThemeTokens } from "../../types";

type SectionProps = {
  theme: ThemeTokens;
  id?: string;
  className?: string;
  builderSectionId?: string;
  deferRendering?: boolean;
  containIntrinsicSize?: string;
  children: ReactNode;
};

export function Section({
  theme,
  id,
  className,
  builderSectionId,
  deferRendering = false,
  containIntrinsicSize,
  children,
}: SectionProps) {
  const sectionStyle: CSSProperties | undefined = deferRendering
    ? {
        contentVisibility: "auto",
        containIntrinsicSize: containIntrinsicSize ?? "1px 900px",
      }
    : undefined;

  return (
    <section
      id={id}
      data-builder-section={builderSectionId}
      className={clsx(theme.sectionSpacing, className)}
      style={sectionStyle}
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
