import clsx from "clsx";
import type { CategoryCard, FeatureItem, ProductInfoCard } from "../../types";

type FeatureIconProps = {
  name: FeatureItem["icon"];
};

type CategoryIconProps = {
  name: CategoryCard["icon"];
};

type InfoIconProps = {
  name: ProductInfoCard["icon"];
};

type StarIconProps = {
  className?: string;
};

export function FeatureIcon({ name }: FeatureIconProps) {
  switch (name) {
    case "shipping":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M3 6h11v7h3.5l2.5 3v2h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3V6z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M3 6h11v7h4l2 3v2h-2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="7" cy="18" r="1.5" fill="currentColor" />
          <circle cx="15" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );
    case "return":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M7 7h7a5 5 0 1 1 0 10h-2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M7 7l3-3M7 7l3 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case "secure":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M9 12l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case "support":
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M12 4a6 6 0 0 0-6 6v4a3 3 0 0 0 3 3h1v-6H7"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M12 4a6 6 0 0 1 6 6v4a3 3 0 0 1-3 3h-1v-6h3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
      );
  }
}

export function CategoryIcon({ name }: CategoryIconProps) {
  switch (name) {
    case "women":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M12 4a4 4 0 1 1-4 4 4 4 0 0 1 4-4z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M12 4a4 4 0 1 1-4 4 4 4 0 0 1 4-4z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M12 12v6m0 0h-3m3 0h3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "men":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle
            cx="10"
            cy="14"
            r="4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M14 10l6-6m0 0h-4m4 0v4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "kids":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M7 10h10l-2 9H9l-2-9z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M9 10l3-4 3 4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    case "beauty":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M8 6h8l-1 12H9L8 6z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M10 6V4h4v2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "sport":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="8"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M4 12h16M12 4v16"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
      );
    case "home":
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M4 10l8-6 8 6v8H4v-8z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M9 18v-5h6v5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
  }
}

export function InfoIcon({ name }: InfoIconProps) {
  switch (name) {
    case "shipping":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M3 6h11v7h3.5l2.5 3v2h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3V6z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M3 6h11v7h4l2 3v2h-2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="7" cy="18" r="1.5" fill="currentColor" />
          <circle cx="15" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );
    case "return":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M7 7h7a5 5 0 1 1 0 10h-2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M7 7l3-3M7 7l3 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case "delivery":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="8"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M12 4v16M4 12h16"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
      );
    case "refund":
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <rect
            x="3.5"
            y="6"
            width="17"
            height="12"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M6 10h6M12 14l-2 2-2-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
  }
}

export function StarIcon({ className }: StarIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={clsx("h-4 w-4", className)}
      aria-hidden="true"
    >
      <path
        d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}
