/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ScheduledEmailsClient } from "@/app/(app)/messagerie/_components/scheduled-emails-client";
import type { ScheduledEmailSummary } from "@/server/messaging-scheduled";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock("@/app/(app)/messagerie/actions", () => ({
  cancelScheduledEmailAction: vi.fn(),
  rescheduleScheduledEmailAction: vi.fn(),
}));

it("shows refreshed server results and only offers actions on pending or failed emails", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  const email: ScheduledEmailSummary = {
    id: "test", subject: "Rendez-vous", to: ["test@example.test"], cc: [], bcc: [],
    sendAt: "2026-03-01T10:00:00.000Z", createdAt: "2026-02-28T12:00:00.000Z",
    status: "PENDING", failureReason: null, previewText: "", attachmentsCount: 0,
  };
  const render = (items: ScheduledEmailSummary[]) =>
    act(() => root.render(createElement(ScheduledEmailsClient, { items })));
  try {
    await render([]);
    await act(() => container.querySelector("button")!.click());
    expect(refresh).toHaveBeenCalledOnce();
    for (const status of ["PENDING", "FAILED", "SENDING", "CANCELLED"] as const) {
      await render([{ ...email, status }]);
      expect(container.textContent).toContain(email.subject);
      const actions = Array.from(container.querySelectorAll("button"), (button) => button.textContent?.trim());
      expect(actions).toEqual(status === "PENDING" || status === "FAILED"
        ? ["Actualiser", "Modifier", "Annuler"]
        : ["Actualiser"]);
    }
    await render([]);
    expect(container.textContent).toContain("Aucun envoi planifié");
  } finally {
    await act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
