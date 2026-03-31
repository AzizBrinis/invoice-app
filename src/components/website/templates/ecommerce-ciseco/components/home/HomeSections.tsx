import { useCallback, useEffect } from "react";
import { useCart } from "@/components/website/cart/cart-context";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { HomeProduct, HomeProductStatus, ThemeTokens } from "../../types";
import { toCartProduct } from "../../utils";
import { ExtraSections } from "../builder/ExtraSections";
import { BestSellersSection } from "./BestSellersSection";
import { BlogSection } from "./BlogSection";
import { DepartmentsSection } from "./DepartmentsSection";
import { DiscoverySection } from "./DiscoverySection";
import { ExploreCategoriesSection } from "./ExploreCategoriesSection";
import { FavoritesSection } from "./FavoritesSection";
import { FeatureRow } from "./FeatureRow";
import { FeaturedProductsSection } from "./FeaturedProductsSection";
import { HeroSection } from "./HeroSection";
import { KidsPromoBanner } from "./KidsPromoBanner";
import { NewArrivalsSection } from "./NewArrivalsSection";
import { PromoSection } from "./PromoSection";
import { TestimonialsSection } from "./TestimonialsSection";

type HomeSectionsProps = {
  theme: ThemeTokens;
  products: HomeProduct[];
  featuredProducts: HomeProduct[];
  status: HomeProductStatus;
  baseLink: (target: string) => string;
  sections: WebsiteBuilderSection[];
  mediaLibrary: WebsiteBuilderMediaAsset[];
  hasBuilder: boolean;
};

export function HomeSections({
  theme,
  products,
  featuredProducts,
  status,
  baseLink,
  sections,
  mediaLibrary,
  hasBuilder,
}: HomeSectionsProps) {
  const { addItem } = useCart();
  const handleAddToCart = useCallback(
    (product: HomeProduct) => {
      addItem(toCartProduct(product));
    },
    [addItem],
  );

  useEffect(() => {
    if (status === "error") {
      console.error("[ciseco-home] Failed to load products.");
    }
  }, [status]);

  const emptyMessage =
    "No items are available yet. Please check back soon.";
  const errorMessage =
    "We could not load the catalog right now. Please refresh the page.";
  const featured = featuredProducts.length ? featuredProducts : products;

  const renderSection = (section: WebsiteBuilderSection) => {
    switch (section.layout) {
      case "home-hero":
      case "page-hero":
        return (
          <HeroSection
            key={section.id}
            theme={theme}
            section={section}
            mediaLibrary={mediaLibrary}
          />
        );
      case "discovery":
        return (
          <DiscoverySection
            key={section.id}
            theme={theme}
            section={section}
            mediaLibrary={mediaLibrary}
          />
        );
      case "new-arrivals":
        return (
          <NewArrivalsSection
            key={section.id}
            theme={theme}
            section={section}
            products={products}
            status={status}
            baseLink={baseLink}
            onAddToCart={handleAddToCart}
            emptyMessage={emptyMessage}
            errorMessage={errorMessage}
          />
        );
      case "features":
        return (
          <FeatureRow key={section.id} theme={theme} section={section} />
        );
      case "home-promo":
        return (
          <PromoSection
            key={section.id}
            theme={theme}
            section={section}
            mediaLibrary={mediaLibrary}
          />
        );
      case "explore":
        return (
          <ExploreCategoriesSection
            key={section.id}
            theme={theme}
            section={section}
          />
        );
      case "best-sellers":
        return (
          <BestSellersSection
            key={section.id}
            theme={theme}
            section={section}
            products={products}
            status={status}
            baseLink={baseLink}
            onAddToCart={handleAddToCart}
            emptyMessage={emptyMessage}
            errorMessage={errorMessage}
          />
        );
      case "kids-banner":
        return (
          <KidsPromoBanner
            key={section.id}
            theme={theme}
            section={section}
            mediaLibrary={mediaLibrary}
          />
        );
      case "featured":
        return (
          <FeaturedProductsSection
            key={section.id}
            theme={theme}
            section={section}
            products={featured}
            status={status}
            baseLink={baseLink}
            onAddToCart={handleAddToCart}
            emptyMessage={emptyMessage}
            errorMessage={errorMessage}
          />
        );
      case "favorites":
        return (
          <FavoritesSection
            key={section.id}
            theme={theme}
            section={section}
            products={products}
            status={status}
            baseLink={baseLink}
            onAddToCart={handleAddToCart}
            emptyMessage={emptyMessage}
            errorMessage={errorMessage}
          />
        );
      case "departments":
        return (
          <DepartmentsSection
            key={section.id}
            theme={theme}
            section={section}
            mediaLibrary={mediaLibrary}
          />
        );
      case "home-blog":
      case "blog-mini":
      case "blog-featured":
      case "blog-latest":
        return (
          <BlogSection
            key={section.id}
            theme={theme}
            section={section}
            mediaLibrary={mediaLibrary}
          />
        );
      case "home-testimonials":
        return (
          <TestimonialsSection
            key={section.id}
            theme={theme}
            section={section}
            mediaLibrary={mediaLibrary}
          />
        );
      default:
        switch (section.type) {
          case "hero":
            return (
              <HeroSection
                key={section.id}
                theme={theme}
                section={section}
                mediaLibrary={mediaLibrary}
              />
            );
          case "services":
            return (
              <DiscoverySection
                key={section.id}
                theme={theme}
                section={section}
                mediaLibrary={mediaLibrary}
              />
            );
          case "promo":
            return (
              <PromoSection
                key={section.id}
                theme={theme}
                section={section}
                mediaLibrary={mediaLibrary}
              />
            );
          case "categories":
            return (
              <ExploreCategoriesSection
                key={section.id}
                theme={theme}
                section={section}
              />
            );
          case "gallery":
            return (
              <DepartmentsSection
                key={section.id}
                theme={theme}
                section={section}
                mediaLibrary={mediaLibrary}
              />
            );
          case "content":
            return (
              <BlogSection
                key={section.id}
                theme={theme}
                section={section}
                mediaLibrary={mediaLibrary}
              />
            );
          case "testimonials":
            return (
              <TestimonialsSection
                key={section.id}
                theme={theme}
                section={section}
                mediaLibrary={mediaLibrary}
              />
            );
          case "products":
            return (
              <NewArrivalsSection
                key={section.id}
                theme={theme}
                section={section}
                products={products}
                status={status}
                baseLink={baseLink}
                onAddToCart={handleAddToCart}
                emptyMessage={emptyMessage}
                errorMessage={errorMessage}
              />
            );
          default:
            return (
              <ExtraSections
                key={section.id}
                theme={theme}
                sections={[section]}
                mediaLibrary={mediaLibrary}
              />
            );
        }
    }
  };

  if (!hasBuilder) {
    return (
      <>
        <HeroSection theme={theme} />
        <BestSellersSection
          theme={theme}
          products={products}
          status={status}
          baseLink={baseLink}
          onAddToCart={handleAddToCart}
          emptyMessage={emptyMessage}
          errorMessage={errorMessage}
        />
        <FeaturedProductsSection
          theme={theme}
          products={featured}
          status={status}
          baseLink={baseLink}
          onAddToCart={handleAddToCart}
          emptyMessage={emptyMessage}
          errorMessage={errorMessage}
        />
        <FavoritesSection
          theme={theme}
          products={products}
          status={status}
          baseLink={baseLink}
          onAddToCart={handleAddToCart}
          emptyMessage={emptyMessage}
          errorMessage={errorMessage}
        />
        <TestimonialsSection theme={theme} />
      </>
    );
  }

  const visibleSections = sections.filter((section) => section.visible !== false);

  return (
    <>
      {visibleSections.map((section) => renderSection(section))}
    </>
  );
}
