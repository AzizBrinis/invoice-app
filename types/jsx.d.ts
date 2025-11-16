import type * as React from "react";

declare global {
  /**
   * Ensure the global `JSX` namespace is always available, even when the React
   * types haven't been pulled into the compilation context yet. This keeps the
   * generated `.next/types/link.d.ts` definitions happy during isolated `tsc`
   * runs (for example when skipping the Next.js type prebuild step).
   */
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any> {}
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
    interface IntrinsicAttributes extends React.Attributes {}
    interface IntrinsicClassAttributes<T>
      extends React.ClassAttributes<T> {}
  }
}
