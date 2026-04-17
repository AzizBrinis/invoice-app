import { randomInt } from "node:crypto";
import { isUniqueConstraintViolation } from "@/lib/db-errors";

export const HUMAN_ORDER_NUMBER_PATTERN = /^\d{6}$/;

const ORDER_NUMBER_MIN = 100000;
const ORDER_NUMBER_MAX_EXCLUSIVE = 1000000;
const DEFAULT_MAX_GENERATION_ATTEMPTS = 20;

type UniqueOrderNumberOptions<T> = {
  create: (orderNumber: string) => Promise<T>;
  isAvailable?: (orderNumber: string) => Promise<boolean>;
  generateCandidate?: () => string;
  maxAttempts?: number;
};

function hasOrderNumberTarget(target: unknown) {
  if (!Array.isArray(target)) {
    return false;
  }

  return target.some(
    (entry) =>
      typeof entry === "string" &&
      entry.toLowerCase().includes("ordernumber"),
  );
}

export function generateOrderNumberCandidate() {
  return String(randomInt(ORDER_NUMBER_MIN, ORDER_NUMBER_MAX_EXCLUSIVE));
}

export function isHumanFriendlyOrderNumber(value: string | null | undefined) {
  if (typeof value !== "string") {
    return false;
  }
  return HUMAN_ORDER_NUMBER_PATTERN.test(value);
}

export function isOrderNumberUniqueConstraintViolation(error: unknown) {
  if (!isUniqueConstraintViolation(error)) {
    return false;
  }

  if (
    error &&
    typeof error === "object" &&
    hasOrderNumberTarget((error as { meta?: { target?: unknown } }).meta?.target)
  ) {
    return true;
  }

  const message =
    error &&
    typeof error === "object" &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";

  return (
    message.includes("ordernumber") ||
    message.includes("order_number") ||
    message.includes("order_userid_ordernumber") ||
    message.includes("order_ordernumber")
  );
}

export async function createWithUniqueOrderNumber<T>({
  create,
  isAvailable,
  generateCandidate = generateOrderNumberCandidate,
  maxAttempts = DEFAULT_MAX_GENERATION_ATTEMPTS,
}: UniqueOrderNumberOptions<T>): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateCandidate();

    if (isAvailable && !(await isAvailable(candidate))) {
      continue;
    }

    try {
      return await create(candidate);
    } catch (error) {
      if (isOrderNumberUniqueConstraintViolation(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    "Impossible de generer un numero de commande unique. Veuillez reessayer.",
  );
}
