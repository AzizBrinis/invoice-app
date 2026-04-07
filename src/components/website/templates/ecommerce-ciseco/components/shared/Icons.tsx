import clsx from "clsx";
import { Heart } from "lucide-react";
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

type WishlistHeartIconProps = {
  className?: string;
  filled?: boolean;
  strokeWidth?: number;
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
    case "workspace":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M4 5h7v6H4V5zm9 0h7v6h-7V5zM4 13h7v6H4v-6zm9 0h7v6h-7v-6z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    case "planning":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <rect
            x="4"
            y="5"
            width="16"
            height="15"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M8 3v4M16 3v4M7.5 11.5l2 2 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "analytics":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M5 19V9m7 10V5m7 14v-7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "operations":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M4 7h16M4 12h10M4 17h16"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M15 7h2m-7 5h2m3 5h2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "support":
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
    case "resources":
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l1.2 1.5H17.5A2.5 2.5 0 0 1 20 9v7.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9z"
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

export function WishlistHeartIcon({
  className,
  filled = false,
  strokeWidth = 1.8,
}: WishlistHeartIconProps) {
  return (
    <Heart
      className={clsx("h-4 w-4", className)}
      aria-hidden="true"
      strokeWidth={strokeWidth}
      fill={filled ? "currentColor" : "transparent"}
    />
  );
}
