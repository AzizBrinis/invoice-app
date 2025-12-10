import { describe, expect, it } from "vitest";
import { parseRequestedSendTime } from "@/server/assistant/email-scheduling";

const BASE_DATE = new Date("2025-02-10T10:00:00.000Z");
const TIMEZONE = "Europe/Paris";

describe("assistant email scheduling parser", () => {
  it("parses « dans une demi-heure »", () => {
    const result = parseRequestedSendTime({
      text: "dans une demi-heure",
      timezone: TIMEZONE,
      referenceDate: BASE_DATE,
    });
    expect(result).not.toBeNull();
    expect(result?.sendAt.toISOString()).toBe("2025-02-10T10:30:00.000Z");
  });

  it("parses « dans 2 heures »", () => {
    const result = parseRequestedSendTime({
      text: "dans 2 heures",
      timezone: TIMEZONE,
      referenceDate: BASE_DATE,
    });
    expect(result).not.toBeNull();
    expect(result?.sendAt.toISOString()).toBe("2025-02-10T12:00:00.000Z");
  });

  it("parses « demain matin à 9h »", () => {
    const result = parseRequestedSendTime({
      text: "demain matin à 9h",
      timezone: TIMEZONE,
      referenceDate: BASE_DATE,
    });
    expect(result).not.toBeNull();
    expect(result?.sendAt.toISOString()).toBe("2025-02-11T08:00:00.000Z");
  });

  it("parses « ce soir »", () => {
    const result = parseRequestedSendTime({
      text: "ce soir",
      timezone: TIMEZONE,
      referenceDate: BASE_DATE,
    });
    expect(result).not.toBeNull();
    expect(result?.sendAt.toISOString()).toBe("2025-02-10T17:00:00.000Z");
  });
});
