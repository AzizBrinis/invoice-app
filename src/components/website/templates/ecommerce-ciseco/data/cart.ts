import type { CartItem } from "../types";

export const CART_ITEMS: CartItem[] = [
  {
    id: "basic-tee",
    name: "Basic Tee",
    color: "Sienna",
    size: "L",
    price: "$199.00",
    quantity: 1,
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=320&q=80",
    stockLabel: "In Stock",
  },
  {
    id: "basic-coahuila",
    name: "Basic Coahuila",
    color: "Black",
    size: "XL",
    price: "$99.00",
    quantity: 2,
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=320&q=80",
    stockLabel: "In Stock",
  },
  {
    id: "nomad-tumbler",
    name: "Nomad Tumbler",
    color: "White",
    size: "M",
    price: "$119.00",
    quantity: 1,
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=320&q=80",
    stockLabel: "In Stock",
  },
];

export const ORDER_SUMMARY = {
  subtotal: "$199.00",
  shipping: "$0.00",
  tax: "$0.00",
  total: "$199.00",
};
