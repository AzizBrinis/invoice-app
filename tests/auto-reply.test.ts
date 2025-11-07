import { describe, expect, it } from "vitest";
import {
  DEFAULT_VACATION_BODY,
  renderVacationTemplate,
} from "@/lib/messaging/auto-reply";

describe("renderVacationTemplate", () => {
  it("replaces placeholders with provided values", () => {
    const template = "Retour prévu {{return_date}} — contactez {{backup_email}}";
    const result = renderVacationTemplate(template, {
      returnDate: "15/11/2025",
      backupEmail: "support@example.com",
    });
    expect(result).toContain("15/11/2025");
    expect(result).toContain("support@example.com");
    expect(result).not.toMatch(/{{\s*return_date\s*}}/i);
    expect(result).not.toMatch(/{{\s*backup_email\s*}}/i);
  });

  it("utilise les valeurs de secours quand rien n'est fourni", () => {
    const result = renderVacationTemplate("Retour {{return_date}} · {{backup_email}}", {});
    expect(result).toContain("bientôt");
    expect(result).toContain("notre équipe support");
  });

  it("intègre les placeholders par défaut dans le message standard", () => {
    const result = renderVacationTemplate(DEFAULT_VACATION_BODY, {
      returnDate: "31/12/2025",
      backupEmail: "help@acme.test",
    });
    expect(result).toContain("31/12/2025");
    expect(result).toContain("help@acme.test");
  });
});
