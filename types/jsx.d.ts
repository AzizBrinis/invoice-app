import type * as React from "react";

declare global {
  /**
   * Ensure the global `JSX` namespace is always available, even when the React
   * types haven't been pulled into the compilation context yet. This keeps the
   * generated `.next/types/link.d.ts` definitions happy during isolated `tsc`
   * runs (for example when skipping the Next.js type prebuild step).
   */
  namespace JSX {
    type Element = React.JSX.Element;
    type ElementClass = React.JSX.ElementClass;
    type IntrinsicElements = React.JSX.IntrinsicElements;
    type IntrinsicAttributes = React.JSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = React.JSX.IntrinsicClassAttributes<T>;
  }
}
