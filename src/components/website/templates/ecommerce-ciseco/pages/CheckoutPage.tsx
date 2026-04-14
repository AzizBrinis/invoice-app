import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
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
import { useAccountProfile } from "../hooks/useAccountProfile";
import { useCisecoI18n } from "../i18n";
import { useCisecoNavigation } from "../navigation";

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

const resolveDefaultPaymentMethod = (
  options: CheckoutPaymentOption[],
): CheckoutPaymentMethod | "" => options[0]?.id ?? "";

const normalizeOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

const splitName = (fullName: string) => {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
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
  const { t } = useCisecoI18n();
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 rounded-3xl border border-dashed border-black/10 bg-white/70 px-6 py-10 text-sm text-slate-500">
        {t("Loading checkout...")}
      </div>
      <div className="min-w-0 pt-2 xl:border-l xl:border-black/5 xl:pl-10">
        <div className="rounded-3xl border border-dashed border-black/10 bg-white/70 px-6 py-10 text-sm text-slate-500">
          {t("Preparing summary...")}
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
  const { t, localizeHref } = useCisecoI18n();
  return (
    <div className="flex flex-col items-start gap-3 py-10 text-sm text-slate-600">
      <p className="text-base font-semibold text-slate-900">
        {t("Your cart is empty")}
      </p>
      <p>{t("Browse the shop to add items before checkout.")}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          asChild
          className={clsx(
            theme.buttonShape,
            "bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900/30",
          )}
        >
          <a href={localizeHref(homeHref || "/")}>{t("Back to shop")}</a>
        </Button>
        <Button
          asChild
          className={clsx(
            theme.buttonShape,
            "border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50",
          )}
        >
          <a href={localizeHref(cartHref)}>{t("View cart")}</a>
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
  const { t } = useCisecoI18n();
  const { navigate } = useCisecoNavigation();
  const { items, hasMissingPrices, isHydrated } = useCart();
  const {
    profile,
    authStatus,
    loginHref,
  } = useAccountProfile({
    redirectOnUnauthorized: false,
    loadStrategy: "mount",
  });
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});

  const paymentMethods = ecommerceSettings?.payments?.methods;
  const configuredPaymentOptions = useMemo(() => {
    const methods = paymentMethods ?? {};
    return [
      methods.cashOnDelivery
        ? { id: "cash_on_delivery" as const, label: "Paiement à la livraison" }
        : null,
      methods.bankTransfer
        ? { id: "bank_transfer" as const, label: "Virement bancaire" }
        : null,
      methods.card
        ? { id: "card" as const, label: "Carte bancaire" }
        : null,
    ].filter((option): option is CheckoutPaymentOption => Boolean(option));
  }, [paymentMethods]);

  const defaultPaymentMethod = useMemo(
    () => resolveDefaultPaymentMethod(configuredPaymentOptions),
    [configuredPaymentOptions],
  );

  const [values, setValues] = useState<CheckoutFormValues>(() => ({
    phone: "",
    email: "",
    firstName: "",
    lastName: "",
    address: "",
    apartment: "",
    city: "",
    country: "Tunisie",
    state: "",
    postalCode: "",
    customerType: "individual",
    companyName: "",
    vatNumber: "",
    notes: "",
    paymentMethod: defaultPaymentMethod,
    termsAccepted: false,
  }));

  useEffect(() => {
    if (!configuredPaymentOptions.length) {
      if (!values.paymentMethod) {
        return;
      }
      setValues((current) => ({
        ...current,
        paymentMethod: "",
      }));
      return;
    }
    if (
      configuredPaymentOptions.some(
        (option) => option.id === values.paymentMethod,
      )
    ) {
      return;
    }
    setValues((current) => ({
      ...current,
      paymentMethod: defaultPaymentMethod,
    }));
  }, [configuredPaymentOptions, defaultPaymentMethod, values.paymentMethod]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }
    setValues((current) => {
      const name = splitName(profile.name);
      const shouldUseCompany =
        current.customerType === "company" ||
        Boolean(profile.companyName?.trim()) ||
        Boolean(profile.vatNumber?.trim());

      return {
        ...current,
        phone: current.phone || profile.phone,
        email: current.email || profile.email,
        firstName: current.firstName || name.firstName,
        lastName: current.lastName || name.lastName,
        address: current.address || profile.address,
        customerType: shouldUseCompany ? "company" : current.customerType,
        companyName: current.companyName || profile.companyName,
        vatNumber: current.vatNumber || profile.vatNumber,
      };
    });
  }, [
    authStatus,
    profile.address,
    profile.companyName,
    profile.email,
    profile.name,
    profile.phone,
    profile.vatNumber,
  ]);

  const handleValueChange = useCallback(
    (field: keyof CheckoutFormValues, value: string | boolean) => {
      setValues((current) => {
        if (field === "customerType" && value === "individual") {
          return {
            ...current,
            customerType: "individual",
            companyName: "",
            vatNumber: "",
          };
        }
        return { ...current, [field]: value };
      });
      setFieldErrors((current) => {
        const errorKey =
          field === "termsAccepted"
            ? "terms"
            : (field as keyof CheckoutFieldErrors);
        if (!(errorKey in current)) {
          return current;
        }
        const next = { ...current };
        delete next[errorKey];
        return next;
      });
    },
    [],
  );

  const checkoutSettings = ecommerceSettings?.checkout ?? {};
  const requirePhone = checkoutSettings.requirePhone ?? false;
  const allowNotes = checkoutSettings.allowNotes ?? true;
  const normalizedTermsUrl = checkoutSettings.termsUrl?.trim() ?? "";
  const termsPath =
    normalizedTermsUrl && !normalizedTermsUrl.startsWith("http")
      ? normalizedTermsUrl.startsWith("/")
        ? normalizedTermsUrl
        : `/${normalizedTermsUrl}`
      : null;
  const termsHref = normalizedTermsUrl
    ? normalizedTermsUrl.startsWith("http")
      ? normalizedTermsUrl
      : baseLink(termsPath ?? normalizedTermsUrl)
    : "";
  const isExternalTerms = termsHref.startsWith("http");
  const termsPreviewApiHref =
    termsPath && !isExternalTerms
      ? `/api/catalogue/cms?slug=${encodeURIComponent(slug)}&mode=${mode}&path=${encodeURIComponent(termsPath)}`
      : null;
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitDisabled) return;

    setStatus("loading");
    setError(null);
    setFieldErrors({});

    if (pricingHidden) {
      setStatus("error");
      setError(t("Pricing is hidden for this shop. Please contact us."));
      return;
    }

    if (hasMissingPrices) {
      setStatus("error");
      setError(t("Some items could not be priced. Remove them to continue."));
      return;
    }

    const trimmedFirstName = values.firstName.trim();
    const trimmedLastName = values.lastName.trim();
    const trimmedEmail = values.email.trim();
    const trimmedPhone = values.phone.trim();
    const trimmedAddress = values.address.trim();
    const trimmedCity = values.city.trim();
    const trimmedState = values.state.trim();
    const trimmedPostalCode = values.postalCode.trim();
    const trimmedCompanyName = values.companyName.trim();
    const trimmedVatNumber = values.vatNumber.trim();
    const nextErrors: CheckoutFieldErrors = {};

    if (!trimmedFirstName) {
      nextErrors.firstName = "Le prénom est obligatoire.";
    }
    if (!trimmedLastName) {
      nextErrors.lastName = "Le nom est obligatoire.";
    }
    if (!trimmedEmail) {
      nextErrors.email = t("Email is required.");
    } else if (!isValidEmail(trimmedEmail)) {
      nextErrors.email = t("Enter a valid email address.");
    }
    if (requirePhone && !trimmedPhone) {
      nextErrors.phone = t("Phone number is required.");
    }
    if (!trimmedAddress) {
      nextErrors.address = "L'adresse est obligatoire.";
    }
    if (!trimmedCity) {
      nextErrors.city = "La ville est obligatoire.";
    }
    if (!trimmedState) {
      nextErrors.state =
        values.country === "Tunisie"
          ? "Le gouvernorat est obligatoire."
          : "La région est obligatoire.";
    }
    if (trimmedPostalCode && values.country === "Tunisie" && !/^\d{4}$/.test(trimmedPostalCode)) {
      nextErrors.postalCode = "Le code postal tunisien doit contenir 4 chiffres.";
    }
    if (values.customerType === "company") {
      if (!trimmedCompanyName) {
        nextErrors.companyName = "Le nom de société est obligatoire.";
      }
      if (!trimmedVatNumber) {
        nextErrors.vatNumber = "Le matricule fiscal est obligatoire.";
      }
    }
    if (isPaymentRequired) {
      if (!values.paymentMethod) {
        nextErrors.paymentMethod = t("Select a payment method.");
      } else if (
        !configuredPaymentOptions.some(
          (option) => option.id === values.paymentMethod,
        )
      ) {
        nextErrors.paymentMethod = t("Select a valid payment method.");
      }
    }
    if (normalizedTermsUrl && !values.termsAccepted) {
      nextErrors.terms = t("Please accept the terms.");
    }

    if (Object.keys(nextErrors).length > 0) {
      setStatus("error");
      setFieldErrors(nextErrors);
      setError(t("Please check the highlighted fields."));
      return;
    }

    const fullName = [trimmedFirstName, trimmedLastName].join(" ").trim();
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
            productId: item.product.id,
            quantity: item.quantity,
            selectedOptions: item.product.selectedOptions ?? null,
          })),
          customer: {
            name: fullName,
            email: trimmedEmail,
            phone: normalizeOptional(trimmedPhone),
            type: values.customerType,
            company:
              values.customerType === "company"
                ? normalizeOptional(trimmedCompanyName)
                : null,
            vatNumber:
              values.customerType === "company"
                ? normalizeOptional(trimmedVatNumber)
                : null,
            address,
          },
          notes: allowNotes ? normalizeOptional(values.notes) : null,
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
            t(`We could not create your order (status ${response.status}).`),
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
          throw new Error(t("Unable to launch payment. Please try again."));
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
              token: confirmationToken,
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
              t(`Payment could not start (status ${checkoutResponse.status}).`),
          );
        }
        checkoutUrl = checkoutResult?.checkoutUrl ?? null;
      }

      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
      } else {
        navigate(confirmationTarget);
      }
    } catch (submissionError) {
      console.error("[checkout] order creation failed", submissionError);
      setStatus("error");
      setError(
        submissionError instanceof Error
          ? t(submissionError.message)
          : t("Unable to submit your order right now."),
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form
      className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10 2xl:grid-cols-[minmax(0,1fr)_380px]"
      onSubmit={handleSubmit}
    >
      <div className="min-w-0 space-y-4">
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
          paymentOptions={configuredPaymentOptions}
          bankTransferInstructions={bankTransferInstructions}
          isSubmitting={isLoading}
          isSubmitDisabled={isSubmitDisabled}
          requirePhone={requirePhone}
          showTerms={Boolean(normalizedTermsUrl)}
          termsHref={termsHref}
          termsPreviewApiHref={termsPreviewApiHref}
          isExternalTerms={isExternalTerms}
          showOrderNotes={allowNotes}
          loginHref={loginHref}
          isAuthenticated={authStatus === "authenticated"}
        />
      </div>
      <div className="min-w-0 pt-2 xl:border-l xl:border-black/5 xl:pl-10">
        <div className="xl:sticky xl:top-24">
          <OrderSummary
            theme={theme}
            isSubmitting={isLoading}
            isSubmitDisabled={isSubmitDisabled}
            showPrices={showPrices}
          />
        </div>
      </div>
    </form>
  );
}

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
  const { t } = useCisecoI18n();
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
              {t(heroSection?.title ?? "Checkout")}
            </h1>
            {heroSubtitle ? (
              <p className="text-sm text-slate-600">{t(heroSubtitle)}</p>
            ) : (
              <p className="text-sm text-slate-600">
                Finalisez votre commande avec vos vraies coordonnées de
                livraison et le mode de paiement adapté à la Tunisie.
              </p>
            )}
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
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}
