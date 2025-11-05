import { describe, it, expect } from "vitest";
import { sanitizeEmailHtml } from "@/lib/email-html";
import { DEFAULT_SAVED_RESPONSES } from "@/lib/messaging/default-responses";
import { fillPlaceholders } from "@/lib/messaging/placeholders";

describe("sanitizeEmailHtml", () => {
  it("preserves table layout styles needed by invoice templates", () => {
    const html = `
      <table style="border-collapse:separate;border-spacing:0;">
        <tr>
          <td style="border-collapse:collapse;border-spacing:0;">Montant TTC</td>
        </tr>
      </table>
    `;

    const sanitized = sanitizeEmailHtml(html);

    expect(sanitized).toContain("border-collapse:separate");
    expect(sanitized).toContain("border-spacing:0");
  });

  it("keeps styling on the default quote template after placeholder substitution", () => {
    const template =
      DEFAULT_SAVED_RESPONSES.find(
        (entry) =>
          entry.slug === "default-quote-template" && entry.format === "HTML",
      )?.content ?? "";
    const values = {
      client_name: "Jean Dupont",
      quote_number: "Q-2024-001",
      quote_date: "12/01/2024",
      project_name: "Modernisation site web",
      total_ht: "1000,00 EUR",
      total_tva: "190,00 EUR",
      total_ttc: "1190,00 EUR",
      quote_valid_until: "31/01/2024",
      company_name: "Studio Alpha",
      company_email: "contact@studio-alpha.fr",
      company_phone: "+33 1 23 45 67 89",
      company_address: "10 rue de Paris, 75000 Paris",
    };

    const filled = fillPlaceholders(template, values);
    const sanitized = sanitizeEmailHtml(filled);

    expect(sanitized).toContain("border-collapse:separate");
    expect(sanitized).toContain("border-spacing:0");
    expect(sanitized).not.toContain("{{");
  });
});
