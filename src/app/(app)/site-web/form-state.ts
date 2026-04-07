export type WebsiteContentFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string | undefined>;
};

export const INITIAL_WEBSITE_CONTENT_FORM_STATE: WebsiteContentFormState = {
  status: "idle",
};

export type WebsiteEcommerceFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string | undefined>;
};

export const INITIAL_WEBSITE_ECOMMERCE_FORM_STATE: WebsiteEcommerceFormState = {
  status: "idle",
};

export type WebsiteCmsPageRecord = {
  id: string;
  title: string;
  path: string;
  content: string;
  excerpt: string | null;
  showInFooter: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteCmsPageFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string | undefined>;
  pages?: WebsiteCmsPageRecord[];
  savedPageId?: string | null;
};

export const INITIAL_WEBSITE_CMS_PAGE_FORM_STATE: WebsiteCmsPageFormState = {
  status: "idle",
};

export type DomainFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const INITIAL_DOMAIN_FORM_STATE: DomainFormState = {
  status: "idle",
};
