"use server";

import {
  createClientPaymentsInvitationAction as createClientPaymentsInvitationActionBase,
  createClientPaymentsInvitationInlineAction as createClientPaymentsInvitationInlineActionBase,
} from "@/app/(app)/clients/actions";

export type {
  ClientPaymentWorkspaceActionResult,
  SerializedPendingInvitation,
} from "@/app/(app)/clients/actions";

export async function createClientPaymentsInvitationAction(
  formData: FormData,
) {
  return createClientPaymentsInvitationActionBase(formData);
}

export async function createClientPaymentsInvitationInlineAction(
  formData: FormData,
) {
  return createClientPaymentsInvitationInlineActionBase(formData);
}
