import { describe, expect, it } from "vitest";
import {
  htmlToText,
  OrderEmailError,
  orderEmailSubject,
  renderOrderEmailBody,
  resolveDevSmtpOverride,
} from "@/server/digital-products/order-email";

describe("digital-order e-mail", () => {
  it("uses the order reference in the subject", () => {
    expect(orderEmailSubject("XKBKNABJK")).toBe("Commande XKBKNABJK");
  });

  it("refuses to e-mail customers outside production without a local SMTP catcher", () => {
    expect(() => resolveDevSmtpOverride({ NODE_ENV: "development" })).toThrow(OrderEmailError);
    expect(() => resolveDevSmtpOverride({ NODE_ENV: "test" })).toThrow(OrderEmailError);
    expect(() => resolveDevSmtpOverride({ NODE_ENV: "development", DIGITAL_ORDER_DEV_SMTP_URL: "http://x" })).toThrow(OrderEmailError);
    expect(resolveDevSmtpOverride({ NODE_ENV: "development", DIGITAL_ORDER_DEV_SMTP_URL: "smtp://127.0.0.1:1025" })).toMatchObject({
      host: "127.0.0.1",
      port: 1025,
      secure: false,
    });
  });

  it("ignores the override in production (tenant SMTP is used)", () => {
    expect(resolveDevSmtpOverride({ NODE_ENV: "production", DIGITAL_ORDER_DEV_SMTP_URL: "smtp://127.0.0.1:1025" })).toBeNull();
    expect(resolveDevSmtpOverride({ NODE_ENV: "production" })).toBeNull();
  });

  it("derives a readable plain-text part from the HTML template", () => {
    const text = htmlToText(
      `<table><tr><td>Bonjour,</td></tr><tr><td>Nous vous remercions d'avoir choisi Techno Smart.</td></tr>
       <tr><td>support@techno-smart.tn &middot; +216 99 699 280</td></tr></table>`,
    );
    expect(text).toBe("Bonjour,\nNous vous remercions d'avoir choisi Techno Smart.\nsupport@techno-smart.tn · +216 99 699 280");
  });
});

describe("digital-order e-mail body", () => {
  it("escapes customer-controlled values in an HTML template", () => {
    const { html, text } = renderOrderEmailBody(
      { content: "<p>Bonjour {{client_name}},</p><p>Commande {{order_reference}}</p>", isHtml: true },
      { client_name: '<a href="https://evil.example">Remboursement</a> <img src=x onerror=alert(1)>', order_reference: "XKB" },
    );
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;a href=");
    expect(text).toContain('<a href="https://evil.example">');
    expect(text).toContain("Commande XKB");
  });

  it("escapes plain-text templates and keeps line breaks", () => {
    const { html, text } = renderOrderEmailBody(
      { content: "Bonjour {{client_name}}\nMerci", isHtml: false },
      { client_name: "<b>Amine</b>" },
    );
    expect(html).toContain("&lt;b&gt;Amine&lt;/b&gt;<br />Merci");
    expect(text).toBe("Bonjour <b>Amine</b>\nMerci");
  });
});
