import { describe, expect, it } from "vitest";
import {
  buildOptimisticClientPaymentId,
  isOptimisticClientPaymentId,
  isPersistedClientPayment,
  matchesPaymentFilters,
  reduceOptimisticPaymentsState,
  type PaymentsWorkspaceState,
} from "@/lib/client-payment-optimistic";

const basePayment = {
  id: "payment-1",
  amountCents: 12000,
  currency: "TND",
  date: "2026-03-22T10:00:00.000Z",
  createdAt: "2026-03-22T10:00:00.000Z",
  method: "Virement",
  reference: "PAY-001",
  description: "Paiement test",
  note: null,
  privateNote: null,
  receiptNumber: null,
  receiptIssuedAt: null,
  receiptSentAt: null,
  client: {
    id: "client-1",
    displayName: "Client Test",
    companyName: "Test SARL",
    email: "client@example.com",
  },
  serviceLinks: [],
};

function buildState(): PaymentsWorkspaceState {
  return {
    summary: {
      paymentCount: 1,
      receiptCount: 0,
      clientCount: 1,
      totalsByCurrency: [
        {
          currency: "TND",
          totalAmountCents: 8000,
          paymentCount: 1,
        },
      ],
    },
    paymentsPage: {
      items: [
        {
          ...basePayment,
          id: "payment-existing",
          amountCents: 8000,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      pageCount: 1,
    },
  };
}

describe("client payment optimistic state", () => {
  it("marks temporary payment ids as pending until a real persisted id exists", () => {
    const optimisticPayment = {
      ...basePayment,
      id: buildOptimisticClientPaymentId(123),
    };

    expect(isOptimisticClientPaymentId(optimisticPayment.id)).toBe(true);
    expect(isPersistedClientPayment(optimisticPayment)).toBe(false);
    expect(isOptimisticClientPaymentId(basePayment.id)).toBe(false);
    expect(isPersistedClientPayment(basePayment)).toBe(true);
  });

  it("reconciles a matching optimistic payment into totals and the first page list", () => {
    const state = buildState();
    const filters = {
      search: "",
      clientId: "client-1",
      dateFromValue: null,
      dateToValue: null,
      dateFrom: null,
      dateTo: null,
    };

    expect(matchesPaymentFilters(basePayment, filters)).toBe(true);

    const nextState = reduceOptimisticPaymentsState(
      state,
      {
        type: "create",
        payment: basePayment,
        matchesFilters: true,
      },
      filters,
    );

    expect(nextState.summary.paymentCount).toBe(2);
    expect(nextState.summary.clientCount).toBe(1);
    expect(nextState.summary.totalsByCurrency).toEqual([
      {
        currency: "TND",
        totalAmountCents: 20000,
        paymentCount: 2,
      },
    ]);
    expect(nextState.paymentsPage.total).toBe(2);
    expect(nextState.paymentsPage.items[0]?.id).toBe("payment-1");
    expect(nextState.paymentsPage.items).toHaveLength(2);
  });

  it("leaves the visible state unchanged when the optimistic payment does not match active filters", () => {
    const state = buildState();
    const filters = {
      search: "",
      clientId: "client-2",
      dateFromValue: null,
      dateToValue: null,
      dateFrom: null,
      dateTo: null,
    };

    expect(matchesPaymentFilters(basePayment, filters)).toBe(false);

    const nextState = reduceOptimisticPaymentsState(
      state,
      {
        type: "create",
        payment: basePayment,
        matchesFilters: false,
      },
      filters,
    );

    expect(nextState).toEqual(state);
  });
});
