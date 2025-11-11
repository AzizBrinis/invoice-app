export type WebsiteContentFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string | undefined>;
};

export const INITIAL_WEBSITE_CONTENT_FORM_STATE: WebsiteContentFormState = {
  status: "idle",
};

export type DomainFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const INITIAL_DOMAIN_FORM_STATE: DomainFormState = {
  status: "idle",
};
