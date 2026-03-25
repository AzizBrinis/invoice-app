import type {
  OrderSuccessAddress,
  OrderSuccessItem,
  OrderSuccessPayment,
  OrderSuccessTotals,
} from "../types";

export const ORDER_SUCCESS_ITEMS: OrderSuccessItem[] = [
  {
    id: "nomad-tumbler",
    name: "Nomad Tumbler",
    color: "Black Brown",
    size: "XS",
    price: "$35.00",
    quantity: 1,
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=240&q=80",
  },
  {
    id: "minimalist-watch",
    name: "Minimalist Wristwatch",
    color: "White",
    size: "XL",
    price: "$149.00",
    quantity: 1,
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=240&q=80",
  },
];

export const ORDER_SUCCESS_TOTALS: OrderSuccessTotals = {
  subtotal: "$199.00",
  shipping: "$0.00",
  taxes: "$0.00",
  total: "$199.00",
};

export const ORDER_SUCCESS_SHIPPING: OrderSuccessAddress = {
  name: "Kristin Watson",
  lines: ["7363 Cynthia Pass", "Toronto, ON N3Y 4H8"],
};

export const ORDER_SUCCESS_PAYMENT: OrderSuccessPayment = {
  brand: "Visa",
  last4: "4242",
  expires: "12 / 21",
};
