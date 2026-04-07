"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  calculateDiscountedLineTotals,
  computeAdjustedUnitPriceTTCCents,
} from "@/lib/product-pricing";

export type CartProductOption = {
  kind?: "color" | "size" | "custom";
  groupId?: string | null;
  valueId?: string | null;
  name: string;
  value: string;
  priceAdjustmentCents?: number | null;
};

export type CartProduct = {
  id: string;
  title: string;
  price: string;
  unitAmountCents: number | null;
  unitPriceHTCents: number | null;
  vatRate: number | null;
  discountRate: number | null;
  discountAmountCents?: number | null;
  currencyCode: string;
  image: string;
  tag: string | null;
  slug: string;
  saleMode: "INSTANT" | "QUOTE";
  selectedOptions?: CartProductOption[] | null;
};

type CartEntry = {
  id: string;
  productId: string;
  quantity: number;
  product?: CartProduct | null;
};

export type CartLine = {
  id: string;
  quantity: number;
  product: CartProduct;
  lineSubtotalHTCents: number | null;
  lineDiscountCents: number | null;
  lineTaxCents: number | null;
  lineTotalCents: number | null;
};

export type CartTotals = {
  subtotalHTCents: number;
  totalDiscountCents: number;
  totalTVACents: number;
  totalTTCCents: number;
};

type CartContextValue = {
  items: CartLine[];
  totalItems: number;
  totalAmountCents: number | null;
  totals: CartTotals | null;
  hasMissingPrices: boolean;
  isHydrated: boolean;
  addItem: (product: CartProduct, quantity?: number) => boolean;
  removeItem: (id: string) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const CART_STORAGE_PREFIX = "catalog-cart:";
const CART_STORAGE_POINTER_KEY = "catalog-cart:active-key";
export const CART_ITEM_ADDED_EVENT = "catalog:cart-item-added";

const normalizeQuantity = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeSelectedOptions = (
  value: unknown,
): CartProductOption[] | null => {
  if (!Array.isArray(value)) return null;
  const options = value
    .map((entry): CartProductOption | null => {
      if (!isRecord(entry)) return null;
      const name =
        typeof entry.name === "string"
          ? entry.name
          : typeof entry.label === "string"
            ? entry.label
            : "";
      const optionValue =
        typeof entry.value === "string"
          ? entry.value
          : typeof entry.id === "string"
            ? entry.id
            : "";
      const normalizedName = name.trim();
      const normalizedValue = optionValue.trim();
      if (!normalizedName || !normalizedValue) return null;
      const kind =
        entry.kind === "color" ||
        entry.kind === "size" ||
        entry.kind === "custom"
          ? entry.kind
          : undefined;
      return {
        kind,
        groupId:
          typeof entry.groupId === "string" && entry.groupId.trim().length > 0
            ? entry.groupId
            : null,
        valueId:
          typeof entry.valueId === "string" && entry.valueId.trim().length > 0
            ? entry.valueId
            : null,
        name: normalizedName,
        value: normalizedValue,
        priceAdjustmentCents: normalizeNumber(entry.priceAdjustmentCents),
      };
    })
    .filter((entry): entry is CartProductOption => Boolean(entry));
  return options.length ? options : null;
};

const normalizeCartProduct = (
  value: unknown,
  fallbackId?: string,
): CartProduct | null => {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const id = rawId || fallbackId?.trim() || "";
  if (!id) return null;
  const title =
    typeof value.title === "string" && value.title.trim().length > 0
      ? value.title
      : id;
  const price = typeof value.price === "string" ? value.price : "";
  const currencyCode =
    typeof value.currencyCode === "string" && value.currencyCode.trim().length > 0
      ? value.currencyCode
      : "TND";
  const image = typeof value.image === "string" ? value.image : "";
  const tag =
    typeof value.tag === "string" && value.tag.trim().length > 0
      ? value.tag
      : null;
  const slug =
    typeof value.slug === "string" && value.slug.trim().length > 0
      ? value.slug
      : id;
  const saleMode =
    value.saleMode === "INSTANT" || value.saleMode === "QUOTE"
      ? value.saleMode
      : "INSTANT";
  const selectedOptions = normalizeSelectedOptions(value.selectedOptions);
  return {
    id,
    title,
    price,
    unitAmountCents: normalizeNumber(value.unitAmountCents),
    unitPriceHTCents: normalizeNumber(value.unitPriceHTCents),
    vatRate: normalizeNumber(value.vatRate),
    discountRate: normalizeNumber(value.discountRate),
    discountAmountCents: normalizeNumber(value.discountAmountCents),
    currencyCode,
    image,
    tag,
    slug,
    saleMode,
    selectedOptions,
  };
};

const resolveEntryProduct = (
  entry: CartEntry,
  catalogMap: Map<string, CartProduct>,
) => {
  const catalogProduct = catalogMap.get(entry.productId);
  if (catalogProduct) {
    if (entry.product) {
      const unitPriceHTCents =
        entry.product.unitPriceHTCents ?? catalogProduct.unitPriceHTCents;
      const vatRate = entry.product.vatRate ?? catalogProduct.vatRate;
      const unitAmountCents =
        unitPriceHTCents != null && vatRate != null
          ? computeAdjustedUnitPriceTTCCents({
              saleMode: catalogProduct.saleMode,
              priceTTCCents: null,
              priceHTCents: unitPriceHTCents,
              vatRate,
              discountRate: catalogProduct.discountRate ?? null,
              discountAmountCents: catalogProduct.discountAmountCents ?? null,
            })
          : entry.product.unitAmountCents ?? catalogProduct.unitAmountCents;
      return {
        ...catalogProduct,
        ...entry.product,
        title: catalogProduct.title || entry.product.title,
        price: catalogProduct.price || entry.product.price,
        unitAmountCents,
        unitPriceHTCents,
        vatRate,
        discountRate: catalogProduct.discountRate,
        discountAmountCents: catalogProduct.discountAmountCents,
        currencyCode: catalogProduct.currencyCode || entry.product.currencyCode,
        image: catalogProduct.image || entry.product.image,
        tag: catalogProduct.tag ?? entry.product.tag ?? null,
        slug: catalogProduct.slug || entry.product.slug,
        saleMode: catalogProduct.saleMode,
        selectedOptions: entry.product.selectedOptions,
      };
    }
    return catalogProduct;
  }
  return entry.product ?? null;
};

const readStoredEntries = (storageKey: string): CartEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.reduce<CartEntry[]>((entries, entry) => {
        const product = normalizeCartProduct(
          entry?.product,
          typeof entry?.productId === "string" ? entry.productId : undefined,
        );
        const productId =
          typeof entry?.productId === "string"
            ? entry.productId.trim()
            : product?.id?.trim() ?? "";
        if (!productId) {
          return entries;
        }
        entries.push({
          id: typeof entry?.id === "string" ? entry.id.trim() : productId,
          productId,
          quantity: normalizeQuantity(Number(entry?.quantity)),
          product,
        });
        return entries;
      }, []);
  } catch {
    return [];
  }
};

const writeStoredEntries = (storageKey: string, entries: CartEntry[]) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entries));
    if (
      storageKey.startsWith(CART_STORAGE_PREFIX) &&
      storageKey !== CART_STORAGE_POINTER_KEY
    ) {
      window.localStorage.setItem(CART_STORAGE_POINTER_KEY, storageKey);
    }
  } catch {
    // Ignore storage write failures (private mode, etc.)
  }
};

export const resolveCartStorageKey = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const storedPointer = window.localStorage.getItem(CART_STORAGE_POINTER_KEY);
  if (
    storedPointer &&
    storedPointer.startsWith(CART_STORAGE_PREFIX) &&
    storedPointer !== CART_STORAGE_POINTER_KEY
  ) {
    return storedPointer;
  }
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || key === CART_STORAGE_POINTER_KEY) continue;
    if (!key.startsWith(CART_STORAGE_PREFIX)) continue;
    return key;
  }
  return null;
};

const normalizeEntries = (
  entries: CartEntry[],
  catalogMap: Map<string, CartProduct>,
) => {
  const order: string[] = [];
  const quantities = new Map<string, number>();
  const products = new Map<string, CartProduct>();

  entries.forEach((entry) => {
    if (!entry) return;
    const product = resolveEntryProduct(entry, catalogMap);
    if (!product || product.saleMode !== "INSTANT") {
      return;
    }
    const lineId = getCartLineId(product, entry.productId);
    if (!lineId) return;
    const normalizedQuantity = normalizeQuantity(entry.quantity);
    if (!quantities.has(lineId)) {
      order.push(lineId);
      quantities.set(lineId, normalizedQuantity);
    } else {
      quantities.set(lineId, quantities.get(lineId)! + normalizedQuantity);
    }
    products.set(lineId, product);
  });

  return order.map((id) => ({
    id,
    productId: products.get(id)?.id ?? id,
    quantity: quantities.get(id) ?? 1,
    product: products.get(id) ?? null,
  }));
};

const getOptionSignature = (
  options: CartProductOption[] | null | undefined,
) => {
  if (!options?.length) return "";
  return options
    .map(
      (option) =>
        [
          option.kind ?? "",
          option.groupId ?? "",
          option.valueId ?? "",
          option.name,
          option.value,
          option.priceAdjustmentCents ?? "",
        ].join(":"),
    )
    .join("|");
};

const getCartLineId = (
  product?: CartProduct | null,
  fallbackProductId = "",
) => {
  const productId = product?.id ?? fallbackProductId;
  if (!productId) return "";
  const signature = getOptionSignature(product?.selectedOptions);
  return signature ? `${productId}::${signature}` : productId;
};

const getProductSignature = (product?: CartProduct | null) => {
  if (!product) return "";
  return [
    product.id,
    product.title,
    product.price,
    product.unitAmountCents ?? "",
    product.unitPriceHTCents ?? "",
    product.vatRate ?? "",
    product.discountRate ?? "",
    product.discountAmountCents ?? "",
    product.currencyCode,
    product.image,
    product.tag ?? "",
    product.slug,
    product.saleMode,
    getOptionSignature(product.selectedOptions),
  ].join("::");
};

const areEntriesEqual = (left: CartEntry[], right: CartEntry[]) => {
  if (left.length !== right.length) return false;
  return left.every(
    (entry, index) =>
      entry.id === right[index]?.id &&
      entry.productId === right[index]?.productId &&
      entry.quantity === right[index]?.quantity &&
      getProductSignature(entry.product) ===
        getProductSignature(right[index]?.product),
  );
};

export function CartProvider({
  storageKey,
  catalog,
  children,
}: {
  storageKey: string;
  catalog: CartProduct[];
  children: React.ReactNode;
}) {
  const catalogMap = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog],
  );
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredEntries(storageKey);
    setEntries(stored);
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    setEntries((current) => {
      const normalized = normalizeEntries(current, catalogMap);
      return areEntriesEqual(current, normalized) ? current : normalized;
    });
  }, [catalogMap, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredEntries(storageKey, entries);
  }, [entries, hydrated, storageKey]);

  const addItem = useCallback(
    (product: CartProduct, quantity = 1) => {
      if (product.saleMode !== "INSTANT") {
        return false;
      }
      setEntries((current) =>
        normalizeEntries(
          [
            ...current,
            {
              id: getCartLineId(product, product.id),
              productId: product.id,
              quantity: normalizeQuantity(quantity),
              product,
            },
          ],
          catalogMap,
        ),
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(CART_ITEM_ADDED_EVENT, {
            detail: {
              productId: product.id,
              quantity: normalizeQuantity(quantity),
            },
          }),
        );
      }
      return true;
    },
    [catalogMap],
  );

  const removeItem = useCallback(
    (id: string) => {
      setEntries((current) =>
        normalizeEntries(
          current.filter((entry) => entry.id !== id),
          catalogMap,
        ),
      );
    },
    [catalogMap],
  );

  const updateItemQuantity = useCallback(
    (id: string, quantity: number) => {
      const normalizedQuantity = normalizeQuantity(quantity);
      setEntries((current) =>
        normalizeEntries(
          current.map((entry) =>
            entry.id === id
              ? { ...entry, quantity: normalizedQuantity }
              : entry,
          ),
          catalogMap,
        ),
      );
    },
    [catalogMap],
  );

  const clearCart = useCallback(() => {
    setEntries([]);
  }, []);

  const items = useMemo(() => {
    const lines: CartLine[] = [];
    entries.forEach((entry) => {
      const product = resolveEntryProduct(entry, catalogMap);
      if (!product) return;
      const lineTotals =
        product.unitPriceHTCents != null && product.vatRate != null
          ? calculateDiscountedLineTotals({
              quantity: entry.quantity,
              unitPriceHTCents: product.unitPriceHTCents,
              vatRate: product.vatRate,
              discountRate: product.discountRate ?? null,
              discountAmountCents: product.discountAmountCents ?? null,
            })
          : null;
      lines.push({
        id: entry.id,
        quantity: entry.quantity,
        product,
        lineSubtotalHTCents: lineTotals?.totalHTCents ?? null,
        lineDiscountCents: lineTotals?.discountAmountCents ?? null,
        lineTaxCents: lineTotals?.totalTVACents ?? null,
        lineTotalCents: lineTotals?.totalTTCCents ?? null,
      });
    });
    return lines;
  }, [entries, catalogMap]);

  const totalItems = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.quantity, 0),
    [entries],
  );

  const totals = useMemo(() => {
    if (!items.length) {
      return null;
    }
    let missingPrice = false;
    let subtotalHTCents = 0;
    let totalDiscountCents = 0;
    let totalTVACents = 0;
    let totalTTCCents = 0;
    items.forEach((item) => {
      if (
        item.lineSubtotalHTCents == null ||
        item.lineDiscountCents == null ||
        item.lineTaxCents == null ||
        item.lineTotalCents == null
      ) {
        missingPrice = true;
        return;
      }
      subtotalHTCents += item.lineSubtotalHTCents;
      totalDiscountCents += item.lineDiscountCents;
      totalTVACents += item.lineTaxCents;
      totalTTCCents += item.lineTotalCents;
    });
    return missingPrice
      ? null
      : {
          subtotalHTCents,
          totalDiscountCents,
          totalTVACents,
          totalTTCCents,
        };
  }, [items]);

  const totalAmountCents = useMemo(
    () => totals?.totalTTCCents ?? null,
    [totals],
  );

  const hasMissingPrices = useMemo(
    () => items.some((item) => item.lineTotalCents == null),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems,
      totalAmountCents,
      totals,
      hasMissingPrices,
      isHydrated: hydrated,
      addItem,
      removeItem,
      updateItemQuantity,
      clearCart,
    }),
    [
      addItem,
      clearCart,
      hasMissingPrices,
      hydrated,
      items,
      removeItem,
      totalAmountCents,
      totalItems,
      totals,
      updateItemQuantity,
    ],
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    return {
      items: [],
      totalItems: 0,
      totalAmountCents: null,
      totals: null,
      hasMissingPrices: false,
      isHydrated: true,
      addItem: (product: CartProduct) => {
        console.warn("[cart] CartProvider missing. Item dropped:", product?.id);
        return false;
      },
      removeItem: (id: string) => {
        console.warn("[cart] CartProvider missing. Remove dropped:", id);
      },
      updateItemQuantity: (id: string, quantity: number) => {
        console.warn(
          "[cart] CartProvider missing. Update dropped:",
          id,
          quantity,
        );
      },
      clearCart: () => {
        console.warn("[cart] CartProvider missing. Clear dropped.");
      },
    } satisfies CartContextValue;
  }
  return context;
}
