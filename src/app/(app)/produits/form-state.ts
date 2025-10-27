export type ProductFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  productId?: string;
};

export const INITIAL_PRODUCT_FORM_STATE: ProductFormState = {
  status: "idle",
};
