/**
 * @vitest-environment jsdom
 */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CisecoLocaleProvider } from "@/components/website/templates/ecommerce-ciseco/i18n";
import { CisecoNavigationProvider } from "@/components/website/templates/ecommerce-ciseco/navigation";
import { TestimonialsOrbit } from "@/components/website/templates/ecommerce-ciseco/components/about/TestimonialsOrbit";
import { TestimonialsSection } from "@/components/website/templates/ecommerce-ciseco/components/home/TestimonialsSection";
import type { ThemeTokens } from "@/components/website/templates/ecommerce-ciseco/types";
import type { CatalogPayload } from "@/server/website";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/preview",
  useSearchParams: () => new URLSearchParams("path=%2F&lang=en"),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    height,
    sizes,
    src,
    width,
  }: {
    alt: string;
    className?: string;
    height?: number;
    sizes?: string;
    src: string;
    width?: number;
  }) =>
    createElement("img", {
      alt,
      className,
      height,
      sizes,
      src,
      width,
    }),
}));

const THEME: ThemeTokens = {
  accent: "#22c55e",
  containerClass: "max-w-7xl",
  sectionSpacing: "py-12",
  corner: "rounded-[32px]",
  buttonShape: "rounded-full",
};

const HOME_SITE_REVIEWS: CatalogPayload["siteReviews"] = [
  {
    id: "site-review-home-1",
    authorName: "Alex Morgan",
    authorRole: "Operations lead",
    avatarUrl: "/images/placeholders/portrait-1.svg",
    rating: 5,
    title: "Polished starting point",
    body: "The neutral defaults gave us a polished starting point for our customer experience.",
    createdAt: "2026-04-13T10:00:00.000Z",
  },
  {
    id: "site-review-home-2",
    authorName: "Priya Shah",
    authorRole: "Retail founder",
    avatarUrl: "/images/placeholders/portrait-2.svg",
    rating: 5,
    title: null,
    body: "The site made our collections feel clear and trustworthy.",
    createdAt: "2026-04-12T10:00:00.000Z",
  },
  {
    id: "site-review-home-3",
    authorName: "Noah Lee",
    authorRole: "Studio owner",
    avatarUrl: "/images/placeholders/portrait-3.svg",
    rating: 4,
    title: null,
    body: "It was easy to publish a clean buying experience.",
    createdAt: "2026-04-11T10:00:00.000Z",
  },
];

const ABOUT_TESTIMONIALS = [
  {
    id: "site-review-about-1",
    quote: "Great quality products, affordable prices, fast and friendly delivery.",
    name: "Lennie Swiffan",
    role: "Verified customer",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
  },
  {
    id: "site-review-about-2",
    quote: "The experience felt personal from start to finish.",
    name: "Sam Colton",
    role: "Returning customer",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
  },
  {
    id: "site-review-about-3",
    quote: "The product curation feels thoughtful and easy to trust.",
    name: "Mira Sloan",
    role: null,
    rating: 4,
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80",
  },
];

type RenderedTestApp = {
  container: HTMLDivElement;
  unmount: () => void;
};

function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderWithProviders(element: ReturnType<typeof createElement>): RenderedTestApp {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(
        CisecoNavigationProvider,
        {
          mode: "preview",
          slug: "demo",
          initialHref: "/preview?path=%2F&lang=en",
          initialPath: "/",
          serverRoutedPaths: ["/", "/about"],
        },
        createElement(CisecoLocaleProvider, { initialLocale: "en" }, element),
      ),
    );
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function getActiveSlide(container: ParentNode) {
  return Array.from(container.querySelectorAll("article")).find(
    (element) => element.getAttribute("aria-hidden") === "false",
  );
}

function getActiveDot(container: ParentNode) {
  return container.querySelector('button[aria-current="true"]');
}

describe("ciseco testimonial carousels", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installMatchMedia();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("autoplays and keeps navigation dots in sync on the home testimonials section", () => {
    const app = renderWithProviders(
      createElement(TestimonialsSection, {
        theme: THEME,
        siteReviews: HOME_SITE_REVIEWS,
      }),
    );

    try {
      expect(getActiveSlide(app.container)?.textContent).toContain("Alex Morgan");
      expect(getActiveDot(app.container)?.getAttribute("aria-label")).toContain("1");

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(getActiveSlide(app.container)?.textContent).toContain("Priya Shah");
      expect(getActiveDot(app.container)?.getAttribute("aria-label")).toContain("2");

      const nextButton = app.container.querySelector(
        'button[aria-label="Next testimonial"]',
      ) as HTMLButtonElement | null;
      expect(nextButton).not.toBeNull();

      act(() => {
        nextButton?.click();
      });

      expect(getActiveSlide(app.container)?.textContent).toContain("Noah Lee");
      expect(getActiveDot(app.container)?.getAttribute("aria-label")).toContain("3");

      const firstDot = app.container.querySelector(
        'button[aria-label="Go to testimonial 1"]',
      ) as HTMLButtonElement | null;
      expect(firstDot).not.toBeNull();

      act(() => {
        firstDot?.click();
      });

      expect(getActiveSlide(app.container)?.textContent).toContain("Alex Morgan");
      expect(getActiveDot(app.container)?.getAttribute("aria-label")).toContain("1");
    } finally {
      app.unmount();
    }
  });

  it("autoplays and supports previous/next plus dot navigation on the about testimonials section", () => {
    const app = renderWithProviders(
      createElement(TestimonialsOrbit, {
        theme: THEME,
        title: "Testimonials",
        subtitle: "Approved site reviews will appear here.",
        testimonials: ABOUT_TESTIMONIALS,
        showCustomerPhotos: true,
      }),
    );

    try {
      expect(getActiveSlide(app.container)?.textContent).toContain("Lennie Swiffan");
      expect(
        app.container.querySelector('img[alt="Lennie Swiffan"]'),
      ).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(getActiveSlide(app.container)?.textContent).toContain("Sam Colton");
      expect(getActiveDot(app.container)?.getAttribute("aria-label")).toContain("2");
      expect(app.container.querySelector('img[alt="Sam Colton"]')).not.toBeNull();

      const previousButton = app.container.querySelector(
        'button[aria-label="Previous testimonial"]',
      ) as HTMLButtonElement | null;
      expect(previousButton).not.toBeNull();

      act(() => {
        previousButton?.click();
      });

      expect(getActiveSlide(app.container)?.textContent).toContain("Lennie Swiffan");
      expect(getActiveDot(app.container)?.getAttribute("aria-label")).toContain("1");

      const thirdDot = app.container.querySelector(
        'button[aria-label="Go to testimonial 3"]',
      ) as HTMLButtonElement | null;
      expect(thirdDot).not.toBeNull();

      act(() => {
        thirdDot?.click();
      });

      expect(getActiveSlide(app.container)?.textContent).toContain("Mira Sloan");
      expect(getActiveDot(app.container)?.getAttribute("aria-label")).toContain("3");
    } finally {
      app.unmount();
    }
  });
});
