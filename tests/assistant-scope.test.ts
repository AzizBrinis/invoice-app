import { describe, expect, it } from "vitest";
import { evaluateScopeRequest } from "@/server/assistant/scope";

describe("assistant scope guardrails", () => {
  it("allows Tunisian fiscal questions like FODEC", () => {
    const result = evaluateScopeRequest({
      history: [],
      text: "C’est quoi la FODEC ?",
      context: null,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("keyword");
  });

  it("keeps greetings in scope so the assistant can respond", () => {
    const result = evaluateScopeRequest({
      history: [],
      text: "Salut",
      context: null,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("greeting");
  });

  it("accepts other fiscal terms such as timbre and TVA", () => {
    const timbre = evaluateScopeRequest({
      history: [],
      text: "Quel est le montant du timbre fiscal sur mes factures ?",
      context: null,
    });
    const tva = evaluateScopeRequest({
      history: [],
      text: "Comment déclarer la TVA sur une vente ?",
      context: null,
    });

    expect(timbre.allowed).toBe(true);
    expect(timbre.reason).toBe("keyword");
    expect(tva.allowed).toBe(true);
    expect(tva.reason).toBe("keyword");
  });

  it("still blocks clearly off-topic chatter", () => {
    const result = evaluateScopeRequest({
      history: [],
      text: "Raconte-moi une blague sur les chats",
      context: null,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("out-of-scope");
  });

  it("lets acknowledgements follow a prior in-scope request", () => {
    const initial = evaluateScopeRequest({
      history: [],
      text: "Peux-tu créer un client et préparer un devis ?",
      context: null,
    });
    const followUp = evaluateScopeRequest({
      history: [{ text: "Peux-tu créer un client et préparer un devis ?", metadata: initial.metadata }],
      text: "Ok merci",
      context: null,
    });

    expect(followUp.allowed).toBe(true);
    expect(followUp.reason).toBe("follow-up");
  });
});
