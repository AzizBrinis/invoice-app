export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(amountCents: number): number {
  return amountCents / 100;
}

export function applyDiscount(
  unitAmountCents: number,
  discountRate?: number | null,
): number {
  if (!discountRate) {
    return unitAmountCents;
  }
  return Math.round(unitAmountCents * (1 - discountRate / 100));
}

export function percentageOf(
  baseCents: number,
  rate: number,
): number {
  return Math.round(baseCents * (rate / 100));
}
