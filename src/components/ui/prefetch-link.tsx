"use client";

import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import type { Route } from "next";
import { usePrefetchOnHover } from "@/lib/hooks/usePrefetchOnHover";

type PrefetchLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
  href: Route | string;
};

export const PrefetchLink = forwardRef<HTMLAnchorElement, PrefetchLinkProps>(
  function PrefetchLink(
    { href, onMouseEnter, onFocus, onTouchStart, prefetch = true, ...props },
    ref,
  ) {
    const prefetchHandlers = usePrefetchOnHover(href);

    return (
      <Link
        ref={ref}
        href={href as Route}
        prefetch={prefetch}
        onMouseEnter={(event) => {
          if (prefetch !== false) {
            prefetchHandlers.onMouseEnter();
          }
          onMouseEnter?.(event);
        }}
        onFocus={(event) => {
          if (prefetch !== false) {
            prefetchHandlers.onFocus();
          }
          onFocus?.(event);
        }}
        onTouchStart={(event) => {
          if (prefetch !== false) {
            prefetchHandlers.onTouchStart();
          }
          onTouchStart?.(event);
        }}
        {...props}
      />
    );
  },
);
