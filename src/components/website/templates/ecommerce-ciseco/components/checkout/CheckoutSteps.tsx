import clsx from "clsx";
import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ThemeTokens } from "../../types";
import { useCisecoI18n } from "../../i18n";

export type CheckoutPaymentMethod = "card" | "bank_transfer" | "cash_on_delivery";
export type CheckoutCustomerType = "individual" | "company";

export type CheckoutPaymentOption = {
  id: CheckoutPaymentMethod;
  label: string;
};

export type CheckoutFormValues = {
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  city: string;
  country: string;
  state: string;
  postalCode: string;
  customerType: CheckoutCustomerType;
  companyName: string;
  vatNumber: string;
  notes: string;
  paymentMethod: CheckoutPaymentMethod | "";
  termsAccepted: boolean;
};

type CheckoutFieldKey =
  | "phone"
  | "email"
  | "firstName"
  | "lastName"
  | "address"
  | "city"
  | "state"
  | "postalCode"
  | "companyName"
  | "vatNumber"
  | "paymentMethod"
  | "terms";

export type CheckoutFieldErrors = Partial<Record<CheckoutFieldKey, string>>;

type CheckoutStepsProps = {
  theme: ThemeTokens;
  values: CheckoutFormValues;
  fieldErrors: CheckoutFieldErrors;
  onValueChange: (
    field: keyof CheckoutFormValues,
    value: string | boolean,
  ) => void;
  paymentOptions: CheckoutPaymentOption[];
  bankTransferInstructions: string;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  requirePhone: boolean;
  showTerms: boolean;
  termsHref: string;
  termsPreviewApiHref?: string | null;
  isExternalTerms: boolean;
  showOrderNotes: boolean;
  loginHref: string;
  isAuthenticated: boolean;
};

type StepKey = "contact" | "shipping" | "payment";

type StepCardProps = {
  theme: ThemeTokens;
  icon: ReactNode;
  label: string;
  summary: string;
  isOpen: boolean;
  onChange: () => void;
  children: ReactNode;
  isChangeDisabled?: boolean;
};

type ContactInfoFormProps = {
  theme: ThemeTokens;
  values: CheckoutFormValues;
  fieldErrors: CheckoutFieldErrors;
  onValueChange: CheckoutStepsProps["onValueChange"];
  onNext: () => void;
  isSubmitting: boolean;
  requirePhone: boolean;
  loginHref: string;
  isAuthenticated: boolean;
};

type ShippingFormProps = {
  theme: ThemeTokens;
  values: CheckoutFormValues;
  fieldErrors: CheckoutFieldErrors;
  onValueChange: CheckoutStepsProps["onValueChange"];
  onNext: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  showOrderNotes: boolean;
};

type PaymentMethodsProps = {
  theme: ThemeTokens;
  values: CheckoutFormValues;
  fieldErrors: CheckoutFieldErrors;
  onValueChange: CheckoutStepsProps["onValueChange"];
  paymentOptions: CheckoutPaymentOption[];
  bankTransferInstructions: string;
  onBack: () => void;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  showTerms: boolean;
  termsHref: string;
  termsPreviewApiHref?: string | null;
  isExternalTerms: boolean;
};

type TermsPreviewDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  termsHref: string;
  termsPreviewApiHref?: string | null;
  isExternalTerms: boolean;
};

const inputClassName =
  "min-h-12 w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-70";

const selectClassName =
  "min-h-12 w-full appearance-none rounded-full border border-black/10 bg-white px-4 py-2.5 pr-11 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-70";

const textareaClassName =
  "w-full rounded-3xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-70";

const labelClassName = "text-xs font-semibold text-slate-700";
const helperTextClassName = "text-[11px] text-slate-500";
const errorTextClassName = "text-xs text-rose-500";
const fieldClassName = "grid min-w-0 content-start gap-2";
const fieldMessageSlotClassName = "min-h-[1rem]";
const formGridClassName = "grid items-start gap-x-4 gap-y-5 md:grid-cols-2";

const changeButtonClass =
  "border border-black/10 bg-white px-4 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-slate-900 disabled:opacity-60";

const TUNISIAN_GOVERNORATES = [
  "Tunis",
  "Ariana",
  "Ben Arous",
  "La Manouba",
  "Nabeul",
  "Zaghouan",
  "Bizerte",
  "Béja",
  "Jendouba",
  "Le Kef",
  "Siliana",
  "Sousse",
  "Monastir",
  "Mahdia",
  "Sfax",
  "Kairouan",
  "Kasserine",
  "Sidi Bouzid",
  "Gabès",
  "Medenine",
  "Tataouine",
  "Gafsa",
  "Tozeur",
  "Kébili",
] as const;

const COUNTRY_OPTIONS = [
  "Tunisie",
  "France",
  "Algérie",
  "Maroc",
  "Libye",
] as const;

function resolveShippingSummary(values: CheckoutFormValues) {
  const parts = [
    values.address.trim(),
    values.city.trim(),
    values.state.trim(),
    values.country.trim(),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Ajoutez votre adresse de livraison";
}

export function CheckoutSteps({
  theme,
  values,
  fieldErrors,
  onValueChange,
  paymentOptions,
  bankTransferInstructions,
  isSubmitting,
  isSubmitDisabled,
  requirePhone,
  showTerms,
  termsHref,
  termsPreviewApiHref,
  isExternalTerms,
  showOrderNotes,
  loginHref,
  isAuthenticated,
}: CheckoutStepsProps) {
  const [activeStep, setActiveStep] = useState<StepKey>("contact");

  const contactSummary = useMemo(() => {
    const parts = [values.email.trim(), values.phone.trim()].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Ajoutez vos coordonnées";
  }, [values.email, values.phone]);

  const shippingSummary = useMemo(
    () => resolveShippingSummary(values),
    [values],
  );

  const paymentSummary = useMemo(() => {
    if (!paymentOptions.length) {
      return "Paiement à confirmer";
    }
    const selected = paymentOptions.find(
      (option) => option.id === values.paymentMethod,
    );
    return selected?.label ?? "Choisissez un mode de paiement";
  }, [paymentOptions, values.paymentMethod]);

  return (
    <>
      <div className="space-y-6">
        <StepCard
          theme={theme}
          icon={<UserIcon />}
          label="INFORMATIONS"
          summary={contactSummary}
          isOpen={activeStep === "contact"}
          onChange={() => setActiveStep("contact")}
          isChangeDisabled={isSubmitting}
        >
          <ContactInfoForm
            theme={theme}
            values={values}
            fieldErrors={fieldErrors}
            onValueChange={onValueChange}
            onNext={() => setActiveStep("shipping")}
            isSubmitting={isSubmitting}
            requirePhone={requirePhone}
            loginHref={loginHref}
            isAuthenticated={isAuthenticated}
          />
        </StepCard>
        <StepCard
          theme={theme}
          icon={<PinIcon />}
          label="LIVRAISON"
          summary={shippingSummary}
          isOpen={activeStep === "shipping"}
          onChange={() => setActiveStep("shipping")}
          isChangeDisabled={isSubmitting}
        >
          <ShippingForm
            theme={theme}
            values={values}
            fieldErrors={fieldErrors}
            onValueChange={onValueChange}
            onNext={() => setActiveStep("payment")}
            onBack={() => setActiveStep("contact")}
            isSubmitting={isSubmitting}
            showOrderNotes={showOrderNotes}
          />
        </StepCard>
        <StepCard
          theme={theme}
          icon={<PaymentIcon />}
          label="PAIEMENT"
          summary={paymentSummary}
          isOpen={activeStep === "payment"}
          onChange={() => setActiveStep("payment")}
          isChangeDisabled={isSubmitting}
        >
          <PaymentMethods
            theme={theme}
            values={values}
            fieldErrors={fieldErrors}
            onValueChange={onValueChange}
            paymentOptions={paymentOptions}
            bankTransferInstructions={bankTransferInstructions}
            onBack={() => setActiveStep("shipping")}
            isSubmitting={isSubmitting}
            isSubmitDisabled={isSubmitDisabled}
            showTerms={showTerms}
            termsHref={termsHref}
            termsPreviewApiHref={termsPreviewApiHref}
            isExternalTerms={isExternalTerms}
          />
        </StepCard>
      </div>
    </>
  );
}

export function StepCard({
  theme,
  icon,
  label,
  summary,
  isOpen,
  onChange,
  children,
  isChangeDisabled,
}: StepCardProps) {
  return (
    <section
      className={clsx(
        "overflow-hidden border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md",
        theme.corner,
      )}
    >
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-slate-700">
            {icon}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span>{label}</span>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--site-accent-soft)] text-[var(--site-accent)]">
                <CheckIcon />
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
              {summary}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={clsx(
            theme.buttonShape,
            changeButtonClass,
            "self-start sm:self-auto",
          )}
          onClick={onChange}
          aria-expanded={isOpen}
          disabled={isChangeDisabled}
        >
          Modifier
        </button>
      </div>
      <div
        className={clsx(
          "grid transition-[grid-template-rows,opacity] duration-300",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-black/5 px-5 py-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function ContactInfoForm({
  theme,
  values,
  fieldErrors,
  onValueChange,
  onNext,
  isSubmitting,
  requirePhone,
  loginHref,
  isAuthenticated,
}: ContactInfoFormProps) {
  const phoneErrorId = fieldErrors.phone ? "checkout-phone-error" : undefined;
  const emailErrorId = fieldErrors.email ? "checkout-email-error" : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">
            Coordonnées
          </h3>
          <p className="text-xs text-slate-500">
            Utilisez une adresse e-mail valide pour recevoir la confirmation.
          </p>
        </div>
        {isAuthenticated ? (
          <p className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            Commande liée à votre compte client
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Déjà client ?{" "}
            <a
              href={loginHref}
              className="font-semibold text-slate-900 underline decoration-slate-200 underline-offset-2"
            >
              Se connecter
            </a>
          </p>
        )}
      </div>

      <div className={formGridClassName}>
        <label className={fieldClassName}>
          <span className={labelClassName}>
            Téléphone{requirePhone ? " *" : ""}
          </span>
          <input
            id="checkout-phone"
            name="phone"
            type="tel"
            placeholder="+216 20 123 456"
            value={values.phone}
            onChange={(event) => onValueChange("phone", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.phone &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.phone ? true : undefined}
            aria-describedby={phoneErrorId}
            disabled={isSubmitting}
            inputMode="tel"
            autoComplete="tel"
          />
          <FieldNote
            error={fieldErrors.phone}
            errorId={phoneErrorId}
            helperText="Format recommandé : +216 XX XXX XXX"
          />
        </label>
        <label className={fieldClassName}>
          <span className={labelClassName}>Adresse e-mail</span>
          <input
            id="checkout-email"
            name="email"
            type="email"
            placeholder="nom@exemple.tn"
            value={values.email}
            onChange={(event) => onValueChange("email", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.email &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={emailErrorId}
            disabled={isSubmitting}
            autoComplete="email"
          />
          <FieldNote
            error={fieldErrors.email}
            errorId={emailErrorId}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={clsx(
            theme.buttonShape,
            "bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60",
          )}
          onClick={onNext}
          disabled={isSubmitting}
        >
          Continuer vers la livraison
        </button>
      </div>
    </div>
  );
}

export function ShippingForm({
  theme,
  values,
  fieldErrors,
  onValueChange,
  onNext,
  onBack,
  isSubmitting,
  showOrderNotes,
}: ShippingFormProps) {
  const firstNameErrorId = fieldErrors.firstName
    ? "checkout-first-name-error"
    : undefined;
  const lastNameErrorId = fieldErrors.lastName
    ? "checkout-last-name-error"
    : undefined;
  const companyNameErrorId = fieldErrors.companyName
    ? "checkout-company-name-error"
    : undefined;
  const vatNumberErrorId = fieldErrors.vatNumber
    ? "checkout-vat-number-error"
    : undefined;
  const cityErrorId = fieldErrors.city ? "checkout-city-error" : undefined;
  const stateErrorId = fieldErrors.state ? "checkout-state-error" : undefined;
  const postalErrorId = fieldErrors.postalCode
    ? "checkout-postal-error"
    : undefined;
  const addressErrorId = fieldErrors.address
    ? "checkout-address-error"
    : undefined;
  const isTunisia = values.country === "Tunisie";

  return (
    <div className="space-y-5">
      <div className={formGridClassName}>
        <label className={fieldClassName}>
          <span className={labelClassName}>Prénom</span>
          <input
            id="checkout-first-name"
            name="firstName"
            type="text"
            placeholder="Amine"
            value={values.firstName}
            onChange={(event) => onValueChange("firstName", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.firstName &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.firstName ? true : undefined}
            aria-describedby={firstNameErrorId}
            disabled={isSubmitting}
            autoComplete="given-name"
          />
          <FieldNote
            error={fieldErrors.firstName}
            errorId={firstNameErrorId}
          />
        </label>
        <label className={fieldClassName}>
          <span className={labelClassName}>Nom</span>
          <input
            id="checkout-last-name"
            name="lastName"
            type="text"
            placeholder="Ben Salem"
            value={values.lastName}
            onChange={(event) => onValueChange("lastName", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.lastName &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.lastName ? true : undefined}
            aria-describedby={lastNameErrorId}
            disabled={isSubmitting}
            autoComplete="family-name"
          />
          <FieldNote
            error={fieldErrors.lastName}
            errorId={lastNameErrorId}
          />
        </label>
      </div>

      <div className="space-y-3">
        <p className={labelClassName}>Type de client</p>
        <div className="grid gap-3 md:grid-cols-2">
          <CustomerTypeOption
            label="Personne physique"
            description="Commande au nom d'un particulier"
            checked={values.customerType === "individual"}
            onSelect={() => onValueChange("customerType", "individual")}
            disabled={isSubmitting}
          />
          <CustomerTypeOption
            label="Entreprise"
            description="Facturation au nom d'une société"
            checked={values.customerType === "company"}
            onSelect={() => onValueChange("customerType", "company")}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {values.customerType === "company" ? (
        <div className={formGridClassName}>
          <label className={fieldClassName}>
            <span className={labelClassName}>Nom de société</span>
            <input
              id="checkout-company-name"
              name="companyName"
              type="text"
              placeholder="Société Exemple SARL"
              value={values.companyName}
              onChange={(event) =>
                onValueChange("companyName", event.target.value)
              }
              className={clsx(
                inputClassName,
                fieldErrors.companyName &&
                  "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
              )}
              aria-invalid={fieldErrors.companyName ? true : undefined}
              aria-describedby={companyNameErrorId}
              disabled={isSubmitting}
              autoComplete="organization"
            />
            <FieldNote
              error={fieldErrors.companyName}
              errorId={companyNameErrorId}
            />
          </label>
          <label className={fieldClassName}>
            <span className={labelClassName}>Matricule fiscal</span>
            <input
              id="checkout-vat-number"
              name="vatNumber"
              type="text"
              placeholder="1234567/A/M/000"
              value={values.vatNumber}
              onChange={(event) => onValueChange("vatNumber", event.target.value)}
              className={clsx(
                inputClassName,
                fieldErrors.vatNumber &&
                  "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
              )}
              aria-invalid={fieldErrors.vatNumber ? true : undefined}
              aria-describedby={vatNumberErrorId}
              disabled={isSubmitting}
            />
            <FieldNote
              error={fieldErrors.vatNumber}
              errorId={vatNumberErrorId}
            />
          </label>
        </div>
      ) : null}

      <div className={formGridClassName}>
        <label className={fieldClassName}>
          <span className={labelClassName}>Pays</span>
          <div className="relative">
            <select
              id="checkout-country"
              name="country"
              value={values.country}
              onChange={(event) => onValueChange("country", event.target.value)}
              className={selectClassName}
              disabled={isSubmitting}
            >
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
          <FieldNote />
        </label>
        <label className={fieldClassName}>
          <span className={labelClassName}>Ville</span>
          <input
            id="checkout-city"
            name="city"
            type="text"
            placeholder="Tunis"
            value={values.city}
            onChange={(event) => onValueChange("city", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.city &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.city ? true : undefined}
            aria-describedby={cityErrorId}
            disabled={isSubmitting}
            autoComplete="address-level2"
          />
          <FieldNote
            error={fieldErrors.city}
            errorId={cityErrorId}
          />
        </label>
      </div>

      <div className={formGridClassName}>
        <label className={fieldClassName}>
          <span className={labelClassName}>
            {isTunisia ? "Gouvernorat" : "Région / État"}
          </span>
          {isTunisia ? (
            <div className="relative">
              <select
                id="checkout-state"
                name="state"
                value={values.state}
                onChange={(event) => onValueChange("state", event.target.value)}
                className={clsx(
                  selectClassName,
                  fieldErrors.state &&
                    "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
                )}
                aria-invalid={fieldErrors.state ? true : undefined}
                aria-describedby={stateErrorId}
                disabled={isSubmitting}
              >
                <option value="">Sélectionnez un gouvernorat</option>
                {TUNISIAN_GOVERNORATES.map((governorate) => (
                  <option key={governorate} value={governorate}>
                    {governorate}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          ) : (
            <input
              id="checkout-state"
              name="state"
              type="text"
              placeholder="Île-de-France"
              value={values.state}
              onChange={(event) => onValueChange("state", event.target.value)}
              className={clsx(
                inputClassName,
                fieldErrors.state &&
                  "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
              )}
              aria-invalid={fieldErrors.state ? true : undefined}
              aria-describedby={stateErrorId}
              disabled={isSubmitting}
              autoComplete="address-level1"
            />
          )}
          <FieldNote
            error={fieldErrors.state}
            errorId={stateErrorId}
          />
        </label>
        <label className={fieldClassName}>
          <span className={labelClassName}>Code postal</span>
          <input
            id="checkout-postal"
            name="postalCode"
            type="text"
            placeholder={isTunisia ? "1000" : "75008"}
            value={values.postalCode}
            onChange={(event) => onValueChange("postalCode", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.postalCode &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.postalCode ? true : undefined}
            aria-describedby={postalErrorId}
            disabled={isSubmitting}
            autoComplete="postal-code"
            inputMode="numeric"
          />
          <FieldNote
            error={fieldErrors.postalCode}
            errorId={postalErrorId}
            helperText={isTunisia ? "Format habituel : 4 chiffres" : "Facultatif"}
          />
        </label>
      </div>

      <div className={formGridClassName}>
        <label className={fieldClassName}>
          <span className={labelClassName}>Adresse</span>
          <input
            id="checkout-address"
            name="address"
            type="text"
            placeholder="12 rue de Marseille"
            value={values.address}
            onChange={(event) => onValueChange("address", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.address &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.address ? true : undefined}
            aria-describedby={addressErrorId}
            disabled={isSubmitting}
            autoComplete="street-address"
          />
          <FieldNote
            error={fieldErrors.address}
            errorId={addressErrorId}
          />
        </label>
        <label className={fieldClassName}>
          <span className={labelClassName}>App., suite</span>
          <input
            id="checkout-apartment"
            name="apartment"
            type="text"
            placeholder="Bâtiment B, 2ème étage"
            value={values.apartment}
            onChange={(event) => onValueChange("apartment", event.target.value)}
            className={inputClassName}
            disabled={isSubmitting}
            autoComplete="address-line2"
          />
          <FieldNote />
        </label>
      </div>

      {showOrderNotes ? (
        <label className={fieldClassName}>
          <span className={labelClassName}>Instructions de livraison</span>
          <textarea
            id="checkout-notes"
            name="notes"
            rows={4}
            maxLength={1200}
            placeholder="Exemple : appeler avant la livraison, laisser le colis à l'accueil, etc."
            value={values.notes}
            onChange={(event) => onValueChange("notes", event.target.value)}
            className={textareaClassName}
            disabled={isSubmitting}
          />
          <FieldNote helperText="Ces informations seront jointes à votre commande." />
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={clsx(
            theme.buttonShape,
            "bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60",
          )}
          onClick={onNext}
          disabled={isSubmitting}
        >
          Continuer vers le paiement
        </button>
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-60"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Retour aux coordonnées
        </button>
      </div>
    </div>
  );
}

export function PaymentMethods({
  theme,
  values,
  fieldErrors,
  onValueChange,
  paymentOptions,
  bankTransferInstructions,
  onBack,
  isSubmitting,
  isSubmitDisabled,
  showTerms,
  termsHref,
  termsPreviewApiHref,
  isExternalTerms,
}: PaymentMethodsProps) {
  const { t } = useCisecoI18n();
  const [termsPreviewOpen, setTermsPreviewOpen] = useState(false);
  const paymentErrorId = fieldErrors.paymentMethod
    ? "checkout-payment-error"
    : undefined;
  const termsErrorId = fieldErrors.terms ? "checkout-terms-error" : undefined;

  const paymentIcons: Record<CheckoutPaymentMethod, ReactNode> = {
    card: <CardOptionIcon />,
    bank_transfer: <BankIcon />,
    cash_on_delivery: <WalletIcon />,
  };

  const instructions = bankTransferInstructions.trim();
  const bankTransferDetails = instructions ? (
    <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 text-xs leading-6 text-slate-600">
      <p className="whitespace-pre-line">{instructions}</p>
    </div>
  ) : (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
      Les coordonnées de virement seront communiquées après validation de la
      commande.
    </div>
  );

  return (
    <>
      <div className="space-y-5">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Mode de paiement
          </h3>
          <p className="text-xs text-slate-500">
            Choisissez la méthode la plus adaptée à votre commande.
          </p>
        </div>

        {paymentOptions.length ? (
          <div className="space-y-3">
            {paymentOptions.map((option) => {
              const isSelected = values.paymentMethod === option.id;
              return (
                <PaymentOption
                  key={option.id}
                  label={option.label}
                  icon={paymentIcons[option.id]}
                  name="paymentMethod"
                  value={option.id}
                  checked={isSelected}
                  onChange={() => onValueChange("paymentMethod", option.id)}
                  disabled={isSubmitting}
                >
                  {option.id === "bank_transfer" && isSelected ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600">
                        Votre commande sera confirmée dès réception du virement.
                      </p>
                      {bankTransferDetails}
                    </div>
                  ) : null}
                </PaymentOption>
              );
            })}
            {fieldErrors.paymentMethod ? (
              <p id={paymentErrorId} className={errorTextClassName}>
                {fieldErrors.paymentMethod}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Cette commande ne nécessite aucun paiement en ligne. Notre équipe
            vous recontactera pour finaliser le règlement.
          </div>
        )}

        {showTerms ? (
          <div className="space-y-2 rounded-2xl border border-black/5 bg-slate-50/60 px-4 py-4">
            <label className="flex items-start gap-3 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={values.termsAccepted}
                onChange={(event) =>
                  onValueChange("termsAccepted", event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border border-black/10 accent-slate-900"
                disabled={isSubmitting}
              />
              <span className="leading-5">
                Je valide les conditions générales de vente.
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3 pl-7">
              <button
                type="button"
                className="text-xs font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2"
                onClick={() => setTermsPreviewOpen(true)}
              >
                Lire les CGV
              </button>
              {termsHref ? (
                <a
                  href={termsHref}
                  target={isExternalTerms ? "_blank" : undefined}
                  rel={isExternalTerms ? "noreferrer" : undefined}
                  className="text-xs text-slate-500 underline decoration-slate-200 underline-offset-2"
                >
                  Ouvrir la page complète
                </a>
              ) : null}
            </div>
            {fieldErrors.terms ? (
              <p id={termsErrorId} className={errorTextClassName}>
                {fieldErrors.terms}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className={clsx(
              theme.buttonShape,
              "bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60",
            )}
            disabled={isSubmitDisabled}
          >
            {isSubmitting ? t("Submitting...") : "Valider la commande"}
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-60"
            onClick={onBack}
            disabled={isSubmitting}
          >
            Retour à la livraison
          </button>
        </div>
      </div>

      <TermsPreviewDialog
        open={termsPreviewOpen}
        title="Conditions générales de vente"
        onClose={() => setTermsPreviewOpen(false)}
        termsHref={termsHref}
        termsPreviewApiHref={termsPreviewApiHref}
        isExternalTerms={isExternalTerms}
      />
    </>
  );
}

function PaymentOption({
  label,
  icon,
  name,
  value,
  checked,
  onChange,
  disabled,
  children,
}: {
  label: string;
  icon: ReactNode;
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer flex-col gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 transition hover:border-slate-200",
        checked && "border-slate-200 bg-slate-50/70",
        disabled && "opacity-70",
      )}
    >
      <div className="flex items-center gap-3">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 accent-slate-900"
          disabled={disabled}
        />
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-slate-700">
          {icon}
        </span>
        <span className="text-sm font-semibold text-slate-900">{label}</span>
      </div>
      {children ? <div className="space-y-3 pl-9 sm:pl-12">{children}</div> : null}
    </label>
  );
}

function CustomerTypeOption({
  label,
  description,
  checked,
  onSelect,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition",
        checked
          ? "border-slate-900 bg-slate-50"
          : "border-black/10 bg-white hover:border-slate-300",
        disabled && "opacity-70",
      )}
    >
      <input
        type="radio"
        name="customerType"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 accent-slate-900"
        disabled={disabled}
      />
      <span className="space-y-1">
        <span className="block text-sm font-semibold text-slate-900">
          {label}
        </span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </label>
  );
}

function FieldNote({
  error,
  errorId,
  helperText,
}: {
  error?: string;
  errorId?: string;
  helperText?: string;
}) {
  return (
    <span className={fieldMessageSlotClassName}>
      {error ? (
        <span id={errorId} className={errorTextClassName}>
          {error}
        </span>
      ) : helperText ? (
        <span className={helperTextClassName}>{helperText}</span>
      ) : (
        <span
          className={clsx(helperTextClassName, "invisible")}
          aria-hidden="true"
        >
          {"\u00A0"}
        </span>
      )}
    </span>
  );
}

function SelectChevron() {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
        <path
          d="M6 8l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
}

function TermsPreviewDialog({
  open,
  title,
  onClose,
  termsHref,
  termsPreviewApiHref,
  isExternalTerms,
}: TermsPreviewDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const isLoading =
    open && Boolean(termsPreviewApiHref) && !html && !error;

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (typeof document === "undefined" || !open) {
      return;
    }
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !termsPreviewApiHref || html || error) {
      return;
    }
    let active = true;

    fetch(termsPreviewApiHref, {
      method: "GET",
      cache: "force-cache",
    })
      .then(async (response) => {
        const result = (await response.json()) as
          | { page?: { contentHtml?: string | null } }
          | { error?: string };
        if (!response.ok || !("page" in result)) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : "Impossible de charger les conditions générales.",
          );
        }
        if (!active) {
          return;
        }
        setHtml(result.page?.contentHtml ?? "<p>Aucun contenu disponible.</p>");
      })
      .catch((fetchError) => {
        if (!active) {
          return;
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Impossible de charger les conditions générales.",
        );
      });

    return () => {
      active = false;
    };
  }, [error, html, open, reloadKey, termsPreviewApiHref]);

  if (typeof document === "undefined" || !open) {
    return null;
  }

  return createPortal(
    <>
      <div
        className={clsx(
          "fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200",
          "opacity-100",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-terms-title"
        className={clsx(
          "fixed inset-x-4 bottom-4 top-4 z-[130] mx-auto flex w-auto max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl transition-all duration-200 sm:inset-x-6 sm:bottom-8 sm:top-8",
          "translate-y-0 opacity-100",
        )}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <h2
              id="checkout-terms-title"
              className="text-base font-semibold text-slate-900 sm:text-lg"
            >
              {title}
            </h2>
            <p className="text-xs text-slate-500">
              Consultation sans quitter la page de paiement
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer la fenêtre des conditions générales"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6l-12 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-5 py-5 sm:px-6">
          {termsPreviewApiHref ? (
            isLoading ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white px-5 py-10 text-sm text-slate-500">
                Chargement des conditions générales...
              </div>
            ) : error ? (
              <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                <p>{error}</p>
                <button
                  type="button"
                  className="inline-flex font-semibold underline decoration-rose-300 underline-offset-2"
                  onClick={() => {
                    setError(null);
                    setReloadKey((current) => current + 1);
                  }}
                >
                  Réessayer
                </button>
                {termsHref ? (
                  <a
                    href={termsHref}
                    target={isExternalTerms ? "_blank" : undefined}
                    rel={isExternalTerms ? "noreferrer" : undefined}
                    className="inline-flex font-semibold underline decoration-rose-300 underline-offset-2"
                  >
                    Ouvrir la page complète
                  </a>
                ) : null}
              </div>
            ) : (
              <div
                className="prose prose-slate max-w-none rounded-3xl bg-white px-5 py-5 prose-headings:scroll-mt-24 prose-p:text-sm prose-li:text-sm"
                dangerouslySetInnerHTML={{ __html: html ?? "" }}
              />
            )
          ) : termsHref ? (
            <iframe
              title={title}
              src={termsHref}
              className="h-full min-h-[420px] w-full rounded-3xl border border-black/5 bg-white"
              loading="lazy"
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-black/10 bg-white px-5 py-10 text-sm text-slate-500">
              Aucune page de conditions générales disponible pour le moment.
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M6 12l4 4 8-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 3a6 6 0 0 0-6 6c0 4.5 6 11 6 11s6-6.5 6-11a6 6 0 0 0-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="12" cy="9" r="2" fill="currentColor" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7 15h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardOptionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BankIcon() {
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
      <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect
        x="4"
        y="7"
        width="16"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M16 7V5a2 2 0 0 0-2-2H6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="16.5" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
