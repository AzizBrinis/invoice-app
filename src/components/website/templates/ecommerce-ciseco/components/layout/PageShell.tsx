import type { CSSProperties, ReactNode } from "react";
import {
  useCisecoNavigation,
  useCisecoNavigationCapture,
} from "../../navigation";

type PageShellProps = {
  inlineStyles: CSSProperties;
  children: ReactNode;
};

export function PageShell({ inlineStyles, children }: PageShellProps) {
  const { isNavigating } = useCisecoNavigation();
  const navigationCapture = useCisecoNavigationCapture();

  return (
    <div
      data-ciseco-page-shell
      className="relative flex min-h-screen flex-col bg-[var(--ciseco-bg)] text-[var(--ciseco-ink)] supports-[min-height:100dvh]:min-h-[100dvh] [&>main]:flex-1"
      style={inlineStyles}
      {...navigationCapture}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[140] h-1 overflow-hidden"
      >
        <div
          className="h-full origin-left rounded-full bg-[linear-gradient(90deg,var(--site-accent)_0%,rgba(15,23,42,0.92)_100%)] transition-[opacity,transform] duration-300"
          style={{
            opacity: isNavigating ? 1 : 0,
            transform: isNavigating ? "scaleX(1)" : "scaleX(0.2)",
            animation: isNavigating
              ? "ciseco-route-progress 1.1s ease-in-out infinite"
              : "none",
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at top, rgba(15, 23, 42, 0.06), transparent 55%)",
          }}
        />
      </div>
      {children}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-18px);
          }
        }
        [data-reveal] {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.6s ease, transform 0.6s ease;
          transition-delay: var(--reveal-delay, 0ms);
        }
        [data-reveal][data-visible="true"] {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes ciseco-route-progress {
          0% {
            transform: scaleX(0.18);
            opacity: 0.85;
          }
          50% {
            transform: scaleX(0.72);
            opacity: 1;
          }
          100% {
            transform: scaleX(1);
            opacity: 0.7;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-reveal] {
            opacity: 1;
            transform: none;
            transition: none;
          }
          [data-ciseco-page-shell] {
            scroll-behavior: auto;
          }
          .animate-[float_12s_ease-in-out_infinite],
          .animate-[float_14s_ease-in-out_infinite],
          .animate-[float_16s_ease-in-out_infinite],
          [style*="ciseco-route-progress"] {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
