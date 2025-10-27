export type InvoiceFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  issueMap?: Record<string, string>;
  invoiceId?: string;
};

export const INITIAL_INVOICE_FORM_STATE: InvoiceFormState = {
  status: "idle",
};
