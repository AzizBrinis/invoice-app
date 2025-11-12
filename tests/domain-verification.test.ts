import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveTxtMock = vi.fn<(domain: string) => Promise<string[][]>>();
const resolveCnameMock = vi.fn<(domain: string) => Promise<string[]>>();

vi.mock("dns/promises", () => ({
  Resolver: class {
    resolveTxt = resolveTxtMock;
    resolveCname = resolveCnameMock;
  },
}));

import {
  assertCustomDomainRecords,
  DomainVerificationError,
} from "@/lib/domain-verification";

const BASE_OPTIONS = {
  domain: "www.example.com",
  verificationCode: "code-123",
  cnameTarget: "edge.example.com",
};

describe("domain verification", () => {
  beforeEach(() => {
    resolveTxtMock.mockReset();
    resolveCnameMock.mockReset();
    resolveTxtMock.mockResolvedValue([["verification=code-123"]]);
    resolveCnameMock.mockResolvedValue(["edge.example.com"]);
  });

  it("accepts valid TXT + CNAME", async () => {
    await expect(assertCustomDomainRecords(BASE_OPTIONS)).resolves.toBeUndefined();
    expect(resolveTxtMock).toHaveBeenCalledWith(BASE_OPTIONS.domain);
    expect(resolveCnameMock).toHaveBeenCalledWith(BASE_OPTIONS.domain);
  });

  it("fails when TXT record is missing", async () => {
    resolveTxtMock.mockResolvedValue([["v=spf1 include:test"]]);
    await expect(assertCustomDomainRecords(BASE_OPTIONS)).rejects.toMatchObject({
      code: "TXT_NOT_FOUND",
    } satisfies Partial<DomainVerificationError>);
    expect(resolveCnameMock).not.toHaveBeenCalled();
  });

  it("fails when TXT value does not match the verification code", async () => {
    resolveTxtMock.mockResolvedValue([["verification=wrong"]]);
    await expect(assertCustomDomainRecords(BASE_OPTIONS)).rejects.toMatchObject({
      code: "TXT_MISMATCH",
    } satisfies Partial<DomainVerificationError>);
  });

  it("fails when CNAME target differs", async () => {
    resolveCnameMock.mockResolvedValue(["other.example.com"]);
    await expect(assertCustomDomainRecords(BASE_OPTIONS)).rejects.toMatchObject({
      code: "CNAME_MISMATCH",
    } satisfies Partial<DomainVerificationError>);
  });

  it("fails when DNS has no CNAME data", async () => {
    resolveCnameMock.mockRejectedValue(
      Object.assign(new Error("ENODATA"), { code: "ENODATA" }),
    );
    await expect(assertCustomDomainRecords(BASE_OPTIONS)).rejects.toMatchObject({
      code: "CNAME_NOT_FOUND",
    } satisfies Partial<DomainVerificationError>);
  });
});
