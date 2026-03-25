import type { CSSProperties, ReactNode } from "react";

type PageShellProps = {
  inlineStyles: CSSProperties;
  children: ReactNode;
};

export function PageShell({ inlineStyles, children }: PageShellProps) {
  return (
    <div
      className="relative min-h-screen bg-[var(--ciseco-bg)] text-[var(--ciseco-ink)]"
      style={inlineStyles}
    >
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
        @media (prefers-reduced-motion: reduce) {
          [data-reveal] {
            opacity: 1;
            transform: none;
            transition: none;
          }
          .animate-[float_12s_ease-in-out_infinite],
          .animate-[float_14s_ease-in-out_infinite],
          .animate-[float_16s_ease-in-out_infinite] {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
