import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CatalogWebsiteSummary } from "@/server/website";
import { useCart } from "@/components/website/cart/cart-context";
import { Button } from "@/components/ui/button";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { Breadcrumb } from "../components/cart/Breadcrumb";
import {
  CheckoutSteps,
  type CheckoutFieldErrors,
  type CheckoutFormValues,
  type CheckoutPaymentMethod,
  type CheckoutPaymentOption,
} from "../components/checkout/CheckoutSteps";
import { OrderSummary } from "../components/checkout/OrderSummary";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";

type CheckoutPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  baseLink: (path: string) => string;
  slug: string;
  mode: "public" | "preview";
  path?: string | null;
  showPrices: boolean;
  ecommerceSettings: CatalogWebsiteSummary["ecommerceSettings"];
  builder?: WebsiteBuilderPageConfig | null;
};

type OrderApiResponse = {
  status?: string;
  error?: string;
  order?: {
    id?: string | null;
    orderNumber?: string | null;
    currency?: string | null;
    totalTTCCents?: number | null;
    confirmationToken?: string | null;
  };
};

type CheckoutStatus = "idle" | "loading" | "error";

const SUCCESS_PATH = "/order-success";
const PLACEHOLDER_PAYMENT_OPTIONS: CheckoutPaymentOption[] = [
  { id: "card", label: "Debit / Credit Card", isPlaceholder: true },
  { id: "bank_transfer", label: "Internet banking", isPlaceholder: true },
  { id: "cash_on_delivery", label: "Google / Apple Wallet", isPlaceholder: true },
];

const resolveDefaultPaymentMethod = (
  options: CheckoutPaymentOption[],
): CheckoutPaymentMethod | "" => {
  const bankTransfer = options.find((option) => option.id === "bank_transfer");
  return bankTransfer?.id ?? options[0]?.id ?? "";
};

const normalizeOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const buildAddressLine = (values: CheckoutFormValues) => {
  const primaryParts = [
    values.address,
    values.apartment,
    values.city,
    values.state,
    values.postalCode,
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  if (!primaryParts.length) {
    return null;
  }
  const parts = [...primaryParts, values.country.trim()].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
};

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

const buildSuccessHref = (
  baseLink: (path: string) => string,
  params: URLSearchParams,
) => {
  const base = baseLink(SUCCESS_PATH);
  if (typeof window === "undefined") {
    const query = params.toString();
    if (!query) return base;
    return base.includes("?") ? `${base}&${query}` : `${base}?${query}`;
  }
  const url = new URL(base, window.location.origin);
  params.forEach((value, key) => url.searchParams.set(key, value));
  return `${url.pathname}${url.search}`;
};

function CheckoutLoadingState() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.45fr)]">
      <div className="rounded-3xl border border-dashed border-black/10 bg-white/70 px-6 py-10 text-sm text-slate-500">
        Loading checkout...
      </div>
      <div className="pt-8 lg:border-l lg:border-black/5 lg:pl-10 lg:pt-2">
        <div className="rounded-3xl border border-dashed border-black/10 bg-white/70 px-6 py-10 text-sm text-slate-500">
          Preparing summary...
        </div>
      </div>
    </div>
  );
}

function CheckoutEmptyState({
  theme,
  homeHref,
  cartHref,
}: {
  theme: ThemeTokens;
  homeHref: string;
  cartHref: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-10 text-sm text-slate-600">
      <p className="text-base font-semibold text-slate-900">
        Your cart is empty
      </p>
      <p>Browse the shop to add items before checkout.</p>
      <div className="flex flex-wrap gap-3">
        <Button
          asChild
          className={clsx(
            theme.buttonShape,
            "bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900/30",
          )}
        >
          <a href={homeHref || "/"}>Back to shop</a>
        </Button>
        <Button
          asChild
          className={clsx(
            theme.buttonShape,
            "border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50",
          )}
        >
          <a href={cartHref}>View cart</a>
        </Button>
      </div>
    </div>
  );
}

type CheckoutContentProps = {
  theme: ThemeTokens;
  baseLink: (path: string) => string;
  slug: string;
  mode: "public" | "preview";
  path?: string | null;
  homeHref: string;
  cartHref: string;
  showPrices: boolean;
  ecommerceSettings: CatalogWebsiteSummary["ecommerceSettings"];
};

function CheckoutContent({
  theme,
  baseLink,
  slug,
  mode,
  path,
  homeHref,
  cartHref,
  showPrices,
  ecommerceSettings,
}: CheckoutContentProps) {
  const {
    items,
    hasMissingPrices,
    clearCart,
    isHydrated,
  } = useCart();
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const configuredPaymentOptions = useMemo(() => {
    const methods = ecommerceSettings?.payments?.methods ?? {};
    return [
      methods.card ? { id: "card" as const, label: "Debit / Credit Card" } : null,
      methods.bankTransfer
        ? { id: "bank_transfer" as const, label: "Internet banking" }
        : null,
      methods.cashOnDelivery
        ? { id: "cash_on_delivery" as const, label: "Google / Apple Wallet" }
        : null,
    ].filter(
      (option): option is CheckoutPaymentOption => Boolean(option),
    );
  }, [
    ecommerceSettings?.payments?.methods?.bankTransfer,
    ecommerceSettings?.payments?.methods?.card,
    ecommerceSettings?.payments?.methods?.cashOnDelivery,
  ]);
  const paymentOptions =
    configuredPaymentOptions.length > 0
      ? configuredPaymentOptions
      : PLACEHOLDER_PAYMENT_OPTIONS;
  const defaultPaymentMethod = useMemo(
    () => resolveDefaultPaymentMethod(paymentOptions),
    [paymentOptions],
  );
  const [values, setValues] = useState<CheckoutFormValues>(() => ({
    phone: "",
    email: "",
    firstName: "",
    lastName: "",
    address: "",
    apartment: "",
    city: "",
    country: "United States",
    state: "",
    postalCode: "",
    addressType: "home",
    paymentMethod: defaultPaymentMethod,
    marketingOptIn: true,
    termsAccepted: false,
  }));

  useEffect(() => {
    if (!paymentOptions.length) return;
    if (paymentOptions.some((option) => option.id === values.paymentMethod)) {
      return;
    }
    setValues((current) => ({
      ...current,
      paymentMethod: defaultPaymentMethod,
    }));
  }, [defaultPaymentMethod, paymentOptions, values.paymentMethod]);

  const handleValueChange = useCallback(
    (field: keyof CheckoutFormValues, value: string | boolean) => {
      setValues((current) => ({ ...current, [field]: value }));
      setFieldErrors((current) => {
        const errorKey =
          field === "termsAccepted"
            ? "terms"
            : (field as keyof CheckoutFieldErrors);
        if (!(errorKey in current)) return current;
        const next = { ...current };
        delete next[errorKey];
        return next;
      });
    },
    [],
  );

  const checkoutSettings = ecommerceSettings?.checkout ?? {};
  const requirePhone = checkoutSettings.requirePhone ?? false;
  const normalizedTermsUrl = checkoutSettings.termsUrl?.trim() ?? "";
  const termsHref = normalizedTermsUrl
    ? normalizedTermsUrl.startsWith("http")
      ? normalizedTermsUrl
      : baseLink(
          normalizedTermsUrl.startsWith("/")
            ? normalizedTermsUrl
            : `/${normalizedTermsUrl}`,
        )
    : "";
  const isExternalTerms = termsHref.startsWith("http");
  const bankTransferInstructions =
    ecommerceSettings?.payments?.bankTransfer?.instructions?.trim() ?? "";
  const isPaymentRequired = configuredPaymentOptions.length > 0;
  const pricingHidden = !showPrices;
  const isLoading = status === "loading";
  const isSubmitDisabled =
    isLoading || pricingHidden || hasMissingPrices || !isHydrated;
  const resolvedPath = useMemo(() => {
    if (path) return path;
    if (typeof window !== "undefined") {
      return window.location.pathname;
    }
    return "/";
  }, [path]);

  if (isHydrated && items.length === 0) {
    return (
      <CheckoutEmptyState theme={theme} homeHref={homeHref} cartHref={cartHref} />
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitDisabled) return;
    setStatus("loading");
    setError(null);
    setFieldErrors({});

    if (pricingHidden) {
      setStatus("error");
      setError("Pricing is hidden for this shop. Please contact us.");
      return;
    }

    if (hasMissingPrices) {
      setStatus("error");
      setError("Some items could not be priced. Remove them to continue.");
      return;
    }

    const fullName = [values.firstName, values.lastName]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(" ");
    const trimmedEmail = values.email.trim();
    const trimmedPhone = values.phone.trim();
    const nextErrors: CheckoutFieldErrors = {};
    if (fullName.length < 2) {
      nextErrors.firstName = "First name is required.";
      nextErrors.lastName = "Last name is required.";
    }
    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!isValidEmail(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (requirePhone && !trimmedPhone) {
      nextErrors.phone = "Phone number is required.";
    }
    if (isPaymentRequired) {
      if (!values.paymentMethod) {
        nextErrors.paymentMethod = "Select a payment method.";
      } else if (
        !configuredPaymentOptions.some(
          (option) => option.id === values.paymentMethod,
        )
      ) {
        nextErrors.paymentMethod = "Select a valid payment method.";
      }
    }
    if (normalizedTermsUrl && !values.termsAccepted) {
      nextErrors.terms = "Please accept the terms.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setStatus("error");
      setFieldErrors(nextErrors);
      setError("Please check the highlighted fields.");
      return;
    }

    const normalizedPaymentMethod =
      isPaymentRequired && values.paymentMethod ? values.paymentMethod : null;
    const address = buildAddressLine(values);
    try {
      const response = await fetch("/api/catalogue/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          customer: {
            name: fullName,
            email: trimmedEmail,
            phone: normalizeOptional(trimmedPhone),
            company: null,
            address,
          },
          notes: null,
          paymentMethod: normalizedPaymentMethod,
          termsAccepted: normalizedTermsUrl ? values.termsAccepted : undefined,
          slug,
          mode,
          path: resolvedPath,
        }),
      });
      let result: OrderApiResponse | null = null;
      try {
        result = (await response.json()) as OrderApiResponse;
      } catch (parseError) {
        console.error("[checkout] response parse failed", parseError);
      }
      if (!response.ok || result?.error) {
        throw new Error(
          result?.error ??
            `We could not create your order (status ${response.status}).`,
        );
      }

      const orderId = result?.order?.id ?? null;
      const orderNumber = result?.order?.orderNumber ?? null;
      const confirmationToken = result?.order?.confirmationToken ?? null;
      const confirmationParams = new URLSearchParams();
      if (orderId) {
        confirmationParams.set("orderId", orderId);
      }
      if (confirmationToken) {
        confirmationParams.set("token", confirmationToken);
      }
      if (orderNumber) {
        confirmationParams.set("orderNumber", orderNumber);
      }
      const confirmationTarget = buildSuccessHref(
        baseLink,
        confirmationParams,
      );
      let checkoutUrl: string | null = null;
      if (normalizedPaymentMethod === "card" && mode !== "preview") {
        if (!orderId) {
          throw new Error("Unable to launch payment. Please try again.");
        }
        const origin = window.location.origin;
        const successUrl = new URL(confirmationTarget, origin).toString();
        const cancelUrl = new URL(baseLink("/checkout"), origin).toString();
        const checkoutResponse = await fetch(
          "/api/catalogue/payments/checkout",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              orderId,
              method: normalizedPaymentMethod,
              slug,
              mode,
              path: resolvedPath,
              successUrl,
              cancelUrl,
            }),
          },
        );
        let checkoutResult: { checkoutUrl?: string | null; error?: string } | null =
          null;
        try {
          checkoutResult = (await checkoutResponse.json()) as {
            checkoutUrl?: string | null;
            error?: string;
          };
        } catch (parseError) {
          console.error("[checkout] payment response parse failed", parseError);
        }
        if (!checkoutResponse.ok || checkoutResult?.error) {
          throw new Error(
            checkoutResult?.error ??
              `Payment could not start (status ${checkoutResponse.status}).`,
          );
        }
        checkoutUrl = checkoutResult?.checkoutUrl ?? null;
      }

      clearCart();
      window.location.assign(checkoutUrl ?? confirmationTarget);
    } catch (submissionError) {
      console.error("[checkout] order creation failed", submissionError);
      setStatus("error");
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to submit your order right now.",
      );
    }
  }

  return (
    <form
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.45fr)]"
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {error}
          </div>
        ) : null}
        <CheckoutSteps
          theme={theme}
          values={values}
          fieldErrors={fieldErrors}
          onValueChange={handleValueChange}
          paymentOptions={paymentOptions}
          bankTransferInstructions={bankTransferInstructions}
          isSubmitting={isLoading}
          isSubmitDisabled={isSubmitDisabled}
          requirePhone={requirePhone}
          showTerms={Boolean(normalizedTermsUrl)}
          termsHref={termsHref}
          isExternalTerms={isExternalTerms}
        />
      </div>
      <div className="lg:border-l lg:border-black/5 lg:pl-10 lg:pt-1">
        <OrderSummary
          theme={theme}
          isSubmitting={isLoading}
          isSubmitDisabled={isSubmitDisabled}
          showPrices={showPrices}
        />
      </div>
    </form>
  );
}

// Smoke test checklist:
// - Add items to cart and verify checkout lists real products with TND totals.
// - Submit checkout with required fields; order is created and redirects to success.
// - Trigger validation errors and confirm loading/disabled states behave correctly.
export function CheckoutPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  baseLink,
  slug,
  mode,
  path,
  showPrices,
  ecommerceSettings,
  builder,
}: CheckoutPageProps) {
  const cartHref = baseLink("/cart");
  const { isHydrated } = useCart();
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;
  const consumedIds = new Set(
    [heroSection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) =>
      section.visible !== false && !consumedIds.has(section.id),
  );

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main>
        <div
          className={clsx(
            "mx-auto px-6 pb-16 pt-8 sm:px-8 lg:pt-12",
            theme.containerClass,
          )}
          data-builder-section={heroSection?.id}
        >
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              {heroSection?.title ?? "Checkout"}
            </h1>
            {heroSubtitle ? (
              <p className="text-sm text-slate-600">{heroSubtitle}</p>
            ) : null}
            <Breadcrumb
              items={[
                { label: "Home", href: homeHref },
                { label: "Cart", href: cartHref },
                { label: "Checkout" },
              ]}
            />
          </div>
          <div className="mt-8 border-t border-black/5 pt-8">
            {isHydrated ? (
              <CheckoutContent
                theme={theme}
                baseLink={baseLink}
                slug={slug}
                mode={mode}
                path={path}
                homeHref={homeHref}
                cartHref={cartHref}
                showPrices={showPrices}
                ecommerceSettings={ecommerceSettings}
              />
            ) : (
              <CheckoutLoadingState />
            )}
          </div>
        </div>
        {extraSections.length ? (
          <ExtraSections
            theme={theme}
            sections={extraSections}
            mediaLibrary={mediaLibrary}
          />
        ) : null}
      </main>
      <Footer theme={theme} companyName={companyName} />
    </PageShell>
  );
}
