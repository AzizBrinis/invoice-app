export type ClientPickerOption = {
  id: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  isActive: boolean;
};

export type PaymentServicePickerOption = {
  id: string;
  title: string;
  details: string | null;
  priceCents: number;
  isActive: boolean;
};
