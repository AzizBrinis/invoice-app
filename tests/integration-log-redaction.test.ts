import { describe, expect, it } from "vitest";
import { safeErrorName } from "@/server/integrations/prestashop/service";

describe("integration error logging", () => {
  it("keeps the error class but never row values, e-mails or ciphertexts", () => {
    const pg = new Error(
      'duplicate key value violates unique constraint "Client_email_key" Key ("userId", email)=(tenant-1, amine@example.com) DETAIL: Key (email)=(amine@example.com) already exists.',
    );
    const logged = safeErrorName(pg);
    expect(logged).toContain("Error: duplicate key value violates unique constraint");
    expect(logged).not.toContain("amine@example.com");
    expect(logged).not.toContain("tenant-1");
    expect(safeErrorName(new Error("bad v1:QUJDREVGR0hJSktMTU5PUFFSU1RVVldY"))).toBe("Error: bad [ciphertext]");
    expect(safeErrorName("x")).toBe("string");
  });
});
