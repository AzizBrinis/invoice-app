import clsx from "clsx";
import { useMemo, useState, type ReactNode } from "react";
import type { ThemeTokens } from "../../types";

export type CheckoutPaymentMethod = "card" | "bank_transfer" | "cash_on_delivery";

export type CheckoutPaymentOption = {
  id: CheckoutPaymentMethod;
  label: string;
  isPlaceholder?: boolean;
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
  addressType: "home" | "office";
  paymentMethod: CheckoutPaymentMethod | "";
  marketingOptIn: boolean;
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
  isExternalTerms: boolean;
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
  onCancel: () => void;
  isSubmitting: boolean;
  requirePhone: boolean;
};

type ShippingFormProps = {
  theme: ThemeTokens;
  values: CheckoutFormValues;
  fieldErrors: CheckoutFieldErrors;
  onValueChange: CheckoutStepsProps["onValueChange"];
  onNext: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
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
  isExternalTerms: boolean;
};

const inputClassName =
  "w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-70";

const labelClassName = "text-xs font-semibold text-slate-700";

const errorTextClassName = "text-xs text-rose-500";

const secondaryButtonClass =
  "text-xs font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-60";

const changeButtonClass =
  "border border-black/10 bg-white px-4 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-slate-900 disabled:opacity-60";

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
  isExternalTerms,
}: CheckoutStepsProps) {
  const [activeStep, setActiveStep] = useState<StepKey | null>("contact");
  const contactSummary = useMemo(() => {
    const parts = [values.email.trim(), values.phone.trim()].filter(Boolean);
    return parts.length ? parts.join(" / ") : "Add contact details";
  }, [values.email, values.phone]);
  const shippingSummary = useMemo(() => {
    const nameParts = [values.firstName.trim(), values.lastName.trim()].filter(
      Boolean,
    );
    const addressParts = [
      values.address.trim(),
      values.city.trim(),
      values.state.trim(),
    ].filter(Boolean);
    const summary = [...nameParts, ...addressParts].filter(Boolean).join(", ");
    return summary || "Add shipping address";
  }, [values.firstName, values.lastName, values.address, values.city, values.state]);
  const paymentSummary = useMemo(() => {
    const selected = paymentOptions.find(
      (option) => option.id === values.paymentMethod,
    );
    return selected?.label ?? "Choose payment method";
  }, [paymentOptions, values.paymentMethod]);

  return (
    <div className="space-y-6">
      <StepCard
        theme={theme}
        icon={<UserIcon />}
        label="CONTACT INFORMATION"
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
          onCancel={() => setActiveStep(null)}
          isSubmitting={isSubmitting}
          requirePhone={requirePhone}
        />
      </StepCard>
      <StepCard
        theme={theme}
        icon={<PinIcon />}
        label="SHIPPING ADDRESS"
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
          onCancel={() => setActiveStep(null)}
          isSubmitting={isSubmitting}
        />
      </StepCard>
      <StepCard
        theme={theme}
        icon={<PaymentIcon />}
        label="PAYMENT METHOD"
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
          isExternalTerms={isExternalTerms}
        />
      </StepCard>
    </div>
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
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-slate-700">
            {icon}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span>{label}</span>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--site-accent-soft)] text-[var(--site-accent)]">
                <CheckIcon />
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900">{summary}</p>
          </div>
        </div>
        <button
          type="button"
          className={clsx(theme.buttonShape, changeButtonClass)}
          onClick={onChange}
          aria-expanded={isOpen}
          disabled={isChangeDisabled}
        >
          Change
        </button>
      </div>
      <div
        className={clsx(
          "overflow-hidden transition-[max-height,opacity] duration-300",
          isOpen ? "max-h-[1600px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="border-t border-black/5 px-5 py-6">{children}</div>
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
  onCancel,
  isSubmitting,
  requirePhone,
}: ContactInfoFormProps) {
  const phoneErrorId = fieldErrors.phone ? "checkout-phone-error" : undefined;
  const emailErrorId = fieldErrors.email ? "checkout-email-error" : undefined;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Contact information
        </h3>
        <p className="text-xs text-slate-500">
          Do not have an account?{" "}
          <a
            href="#"
            className="font-semibold text-slate-900 underline decoration-slate-200 underline-offset-2"
          >
            Log in
          </a>
        </p>
      </div>
      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className={labelClassName}>
            Your phone number{requirePhone ? " *" : ""}
          </span>
          <input
            id="checkout-phone"
            name="phone"
            type="tel"
            placeholder="+808 xxx"
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
          />
          {fieldErrors.phone ? (
            <span id={phoneErrorId} className={errorTextClassName}>
              {fieldErrors.phone}
            </span>
          ) : null}
        </label>
        <label className="grid gap-2">
          <span className={labelClassName}>Email address</span>
          <input
            id="checkout-email"
            name="email"
            type="email"
            placeholder="you@example.com"
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
          />
          {fieldErrors.email ? (
            <span id={emailErrorId} className={errorTextClassName}>
              {fieldErrors.email}
            </span>
          ) : null}
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={values.marketingOptIn}
          onChange={(event) =>
            onValueChange("marketingOptIn", event.target.checked)
          }
          className="h-4 w-4 rounded border border-black/10 accent-slate-900"
          disabled={isSubmitting}
        />
        Email me news and offers
      </label>
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
          Next to shipping address
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
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
  onCancel,
  isSubmitting,
}: ShippingFormProps) {
  const firstNameErrorId = fieldErrors.firstName
    ? "checkout-first-name-error"
    : undefined;
  const lastNameErrorId = fieldErrors.lastName
    ? "checkout-last-name-error"
    : undefined;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className={labelClassName}>First name</span>
          <input
            id="checkout-first-name"
            name="firstName"
            type="text"
            placeholder="Cole"
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
          />
          {fieldErrors.firstName ? (
            <span id={firstNameErrorId} className={errorTextClassName}>
              {fieldErrors.firstName}
            </span>
          ) : null}
        </label>
        <label className="grid gap-2">
          <span className={labelClassName}>Last name</span>
          <input
            id="checkout-last-name"
            name="lastName"
            type="text"
            placeholder="Enrico"
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
          />
          {fieldErrors.lastName ? (
            <span id={lastNameErrorId} className={errorTextClassName}>
              {fieldErrors.lastName}
            </span>
          ) : null}
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className={labelClassName}>Address</span>
          <input
            id="checkout-address"
            name="address"
            type="text"
            placeholder="123, Dream Avenue, USA"
            value={values.address}
            onChange={(event) => onValueChange("address", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.address &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.address ? true : undefined}
            disabled={isSubmitting}
          />
        </label>
        <label className="grid gap-2">
          <span className={labelClassName}>Apt, Suite *</span>
          <input
            id="checkout-apartment"
            name="apartment"
            type="text"
            placeholder="55U - DD5"
            value={values.apartment}
            onChange={(event) => onValueChange("apartment", event.target.value)}
            className={inputClassName}
            disabled={isSubmitting}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className={labelClassName}>City</span>
          <input
            id="checkout-city"
            name="city"
            type="text"
            placeholder="Norris"
            value={values.city}
            onChange={(event) => onValueChange("city", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.city &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.city ? true : undefined}
            disabled={isSubmitting}
          />
        </label>
        <label className="grid gap-2">
          <span className={labelClassName}>Country</span>
          <select
            id="checkout-country"
            name="country"
            value={values.country}
            onChange={(event) => onValueChange("country", event.target.value)}
            className={inputClassName}
            disabled={isSubmitting}
          >
            <option>United States</option>
            <option>Canada</option>
            <option>France</option>
            <option>Tunisia</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className={labelClassName}>State/Province</span>
          <input
            id="checkout-state"
            name="state"
            type="text"
            placeholder="Texas"
            value={values.state}
            onChange={(event) => onValueChange("state", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.state &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.state ? true : undefined}
            disabled={isSubmitting}
          />
        </label>
        <label className="grid gap-2">
          <span className={labelClassName}>Postal code</span>
          <input
            id="checkout-postal"
            name="postalCode"
            type="text"
            placeholder="2500"
            value={values.postalCode}
            onChange={(event) => onValueChange("postalCode", event.target.value)}
            className={clsx(
              inputClassName,
              fieldErrors.postalCode &&
                "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20",
            )}
            aria-invalid={fieldErrors.postalCode ? true : undefined}
            disabled={isSubmitting}
          />
        </label>
      </div>
      <div className="space-y-3">
        <p className={labelClassName}>Address type</p>
        <div className="flex flex-wrap gap-6 text-xs text-slate-600">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="addressType"
              value="home"
              checked={values.addressType === "home"}
              onChange={() => onValueChange("addressType", "home")}
              className="h-4 w-4 accent-slate-900"
              disabled={isSubmitting}
            />
            <span className="font-semibold text-slate-900">Home</span>
            <span className="text-slate-500">(All Day Delivery)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="addressType"
              value="office"
              checked={values.addressType === "office"}
              onChange={() => onValueChange("addressType", "office")}
              className="h-4 w-4 accent-slate-900"
              disabled={isSubmitting}
            />
            <span className="font-semibold text-slate-900">Office</span>
            <span className="text-slate-500">(Delivery 9 AM - 5 PM)</span>
          </label>
        </div>
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
          Next to payment method
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
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
  isExternalTerms,
}: PaymentMethodsProps) {
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
    <div className="rounded-2xl border border-black/5 bg-white/70 px-4 py-3 text-xs text-slate-600">
      <p className="whitespace-pre-line">{instructions}</p>
    </div>
  ) : (
    <div className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white/70 text-xs text-slate-600">
      {[
        ["Customer", "BooliTheme"],
        ["Bank name", "Example Bank Name"],
        ["Account number", "555 888 777"],
        ["Sort code", "999"],
        ["IBAN", "IBAN"],
        ["BIC", "BIC/Swift"],
      ].map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-4 px-4 py-2"
        >
          <span>{label}</span>
          <span className="font-semibold text-slate-900">{value}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="space-y-5">
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
                    Your order will be delivered to you after you transfer to
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
      {showTerms ? (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={values.termsAccepted}
              onChange={(event) =>
                onValueChange("termsAccepted", event.target.checked)
              }
              className="mt-0.5 h-4 w-4 rounded border border-black/10 accent-slate-900"
              disabled={isSubmitting}
            />
            <span>
              I agree to the{" "}
              <a
                href={termsHref}
                className="font-semibold text-slate-900 underline decoration-slate-200 underline-offset-2"
                target={isExternalTerms ? "_blank" : undefined}
                rel={isExternalTerms ? "noreferrer" : undefined}
              >
                terms and conditions
              </a>
              .
            </span>
          </label>
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
          {isSubmitting ? "Submitting..." : "Confirm order"}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back to shipping address
        </button>
      </div>
    </div>
  );
}

type PaymentOptionProps = {
  label: string;
  icon: ReactNode;
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

function PaymentOption({
  label,
  icon,
  name,
  value,
  checked,
  onChange,
  disabled,
  children,
}: PaymentOptionProps) {
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
      <path
        d="M3 10h18"
        stroke="currentColor"
        strokeWidth="1.5"
      />
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
      <path
        d="M3 10h18"
        stroke="currentColor"
        strokeWidth="1.5"
      />
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
      <path
        d="M4 12h16M12 4v16"
        stroke="currentColor"
        strokeWidth="1.2"
      />
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
