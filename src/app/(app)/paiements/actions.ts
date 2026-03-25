"use server";

import {
  createClientPaymentAction as createClientPaymentActionBase,
  createClientPaymentInlineAction as createClientPaymentInlineActionBase,
  deleteClientPaymentAction as deleteClientPaymentActionBase,
  deleteClientPaymentInlineAction as deleteClientPaymentInlineActionBase,
  sendClientPaymentReceiptEmailAction as sendClientPaymentReceiptEmailActionBase,
} from "@/app/(app)/clients/actions";
import type {
  ClientPaymentWorkspaceActionResult,
  SerializedClientPayment,
} from "@/app/(app)/clients/actions";
import type {
  DocumentEmailActionInput,
  DocumentEmailActionResult,
} from "@/types/document-email";

export type {
  ClientPaymentWorkspaceActionResult,
  SerializedClientPayment,
} from "@/app/(app)/clients/actions";

export async function createClientPaymentAction(formData: FormData) {
  return createClientPaymentActionBase(formData);
}

export async function createClientPaymentInlineAction(
  formData: FormData,
): Promise<
  ClientPaymentWorkspaceActionResult<{ payment: SerializedClientPayment }>
> {
  return createClientPaymentInlineActionBase(formData);
}

export async function deleteClientPaymentAction(
  paymentId: string,
  clientId: string,
  formData?: FormData,
) {
  return deleteClientPaymentActionBase(paymentId, clientId, formData);
}

export async function deleteClientPaymentInlineAction(
  paymentId: string,
): Promise<ClientPaymentWorkspaceActionResult<{ paymentId: string }>> {
  return deleteClientPaymentInlineActionBase(paymentId);
}

export async function sendClientPaymentReceiptEmailAction(
  paymentId: string,
  input: DocumentEmailActionInput,
): Promise<DocumentEmailActionResult> {
  return sendClientPaymentReceiptEmailActionBase(paymentId, input);
}
