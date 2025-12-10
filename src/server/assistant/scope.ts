import type { AssistantContextInput } from "@/server/assistant/types";

type ScopeTag = "in-app" | "out-of-scope";
type ScopeReason =
  | "keyword"
  | "context"
  | "follow-up"
  | "greeting"
  | "out-of-scope";

const RAW_SCOPE_KEYWORDS = [
  "client",
  "clients",
  "customer",
  "customers",
  "prospect",
  "prospects",
  "lead",
  "leads",
  "contact",
  "contacts",
  "crm",
  "pipeline",
  "prospection",
  "fiche client",
  "produit",
  "produits",
  "product",
  "products",
  "catalogue",
  "catalog",
  "article",
  "articles",
  "service",
  "services",
  "prestation",
  "prestations",
  "offre",
  "offres",
  "tarif",
  "tarifs",
  "pricing",
  "prix",
  "plan tarifaire",
  "vente",
  "ventes",
  "commercial",
  "commerce",
  "business",
  "affaires",
  "entreprise",
  "entreprises",
  "societe",
  "societes",
  "processus",
  "workflow",
  "remise",
  "remises",
  "discount",
  "discounts",
  "tva",
  "fodec",
  "timbre",
  "timbre fiscal",
  "droit de timbre",
  "retenue",
  "retenues",
  "retenue a la source",
  "retenues a la source",
  "impot",
  "impots",
  "fiscal",
  "fiscale",
  "fiscalite",
  "taxation",
  "comptabilite",
  "comptable",
  "comptables",
  "taxe",
  "taxes",
  "devis",
  "quote",
  "quotes",
  "quotation",
  "estimate",
  "estimation",
  "proposition commerciale",
  "bon de commande",
  "facture",
  "factures",
  "facturation",
  "invoice",
  "invoices",
  "billing",
  "avoir",
  "avoirs",
  "note d honoraires",
  "note de frais",
  "paiement",
  "paiements",
  "payment",
  "payments",
  "encaissement",
  "encaissements",
  "reglement",
  "reglements",
  "relance",
  "relances",
  "relancer",
  "rappel",
  "rappels",
  "echeance",
  "echeances",
  "acompte",
  "acomptes",
  "solde",
  "messagerie",
  "message",
  "messages",
  "messaging",
  "email",
  "emails",
  "mail",
  "mails",
  "courriel",
  "courriels",
  "mailbox",
  "boite de reception",
  "boite mail",
  "inbox",
  "sent",
  "draft",
  "drafts",
  "brouillon",
  "brouillons",
  "spam",
  "indesirable",
  "indesirables",
  "trash",
  "corbeille",
  "archive",
  "archives",
  "planifie",
  "planifiee",
  "planifiees",
  "planification",
  "scheduled",
  "planifies",
  "programmee",
  "conversation",
  "conversations",
  "tableau de bord",
  "dashboard",
  "reporting",
  "rapport",
  "rapports",
  "analytics",
  "statistiques",
  "indicateur",
  "indicateurs",
  "parametre",
  "parametres",
  "setting",
  "settings",
  "configuration",
  "preferences",
  "compte",
  "site web",
  "site internet",
  "site-web",
  "site builder",
  "site vitrine",
  "page web",
  "page marketing",
  "landing page",
  "landing",
  "website",
  "formulaire",
  "formulaires",
  "catalogue",
  "note",
  "notes",
  "commentaire",
  "commentaires",
  "ligne",
  "lignes",
  "item",
  "items",
  "document",
  "documents",
  "paiements",
];

const IN_SCOPE_KEYWORDS = Array.from(
  new Set(
    RAW_SCOPE_KEYWORDS.map((value) => normalizeScopeText(value)).filter(
      Boolean,
    ),
  ),
);

const ACK_WORDS = new Set([
  "oui",
  "non",
  "ok",
  "okay",
  "daccord",
  "dac",
  "merci",
  "beaucoup",
  "parfait",
  "super",
  "top",
  "cest",
  "bon",
  "ca",
  "marche",
  "bien",
  "recu",
  "tres",
  "genial",
  "impec",
  "parfaitement",
  "excellent",
  "bonjour",
  "bonsoir",
  "salut",
  "hello",
  "va",
]);

const QUESTION_WORDS = new Set([
  "qui",
  "que",
  "quoi",
  "ou",
  "quand",
  "comment",
  "pourquoi",
  "combien",
  "quel",
  "quelle",
  "quelles",
  "quels",
  "who",
  "what",
  "when",
  "where",
  "why",
  "how",
]);

const FOLLOW_UP_COMMAND_REGEX =
  /^(ajoute|ajoutes|ajoutez|ajouter|supprime|supprimes|supprimez|supprimer|retire|retires|retirez|retirer|envoie|envoies|envoyez|envoyer|relance|relances|relancez|relancer|planifie|planifies|planifiez|planifier|annule|annules|annulez|annuler|archive|archives|archivez|archiver|duplique|dupliques|dupliquez|dupliquer|copie|copies|copiez|copier|convertis|convertissez|convertir|reponds|repond|repondez|repondre|reprends|reprend|reprenez|reprendre|poursuis|poursuivre|continue|continues|continuez|valide|validez|valider|confirme|confirmez|confirmer|assigne|assignes|assignez|assigner|applique|appliques|appliquez|appliquer|rappelle|rappelles|rappelez|rappeler|ecris|ecris|ecrivez|ecrire)(?:\s+|-)(le|la|les|lui|leur|leurs|l'|y|en)(?=$|[\s!.?,])/;

const GREETING_WORDS = new Set([
  "bonjour",
  "bonsoir",
  "salut",
  "hello",
  "hi",
  "coucou",
  "yo",
]);

const GREETING_FILLERS = new Set([
  "ca",
  "va",
  "tu",
  "vous",
  "toi",
  "can",
  "you",
  "me",
  "m",
  "moi",
  "nous",
  "hey",
  "yo",
  "svp",
  "stp",
  "please",
  "plz",
  "peux",
  "peut",
  "pouvez",
  "help",
  "assist",
  "assiste",
  "assistance",
  "aide",
  "aider",
]);

const SCOPE_METADATA_KEY = "_scope" as const;

export type ScopeHistoryEntry = {
  text: string;
  metadata?: Record<string, unknown> | null;
};

export type ScopeEvaluation = {
  allowed: boolean;
  metadata: Record<string, unknown>;
  keywordMatch: boolean;
  greetingMatch: boolean;
  followUpCandidate: boolean;
  reason: ScopeReason;
};

export function evaluateScopeRequest(params: {
  history: ScopeHistoryEntry[];
  text: string;
  context?: AssistantContextInput | null;
}): ScopeEvaluation {
  const normalized = normalizeScopeText(params.text ?? "");
  const keywordMatch = Boolean(normalized) && matchesKeyword(normalized);
  const greetingMatch = isGreeting(params.text ?? "");
  const followUpCandidate = looksLikeFollowUp(params.text ?? "");
  const hasPriorInScope = params.history.some((entry) => entryIsInScope(entry));

  const reason: ScopeReason = params.context
    ? "context"
    : keywordMatch
      ? "keyword"
      : greetingMatch
        ? "greeting"
        : followUpCandidate && hasPriorInScope
          ? "follow-up"
          : "out-of-scope";

  const allowed = reason !== "out-of-scope";

  return {
    allowed,
    metadata: buildScopeMetadata({
      tag: allowed ? "in-app" : "out-of-scope",
      reason,
      keywordMatch,
      greetingMatch,
      followUpCandidate,
      contextType: params.context?.type ?? null,
    }),
    keywordMatch,
    greetingMatch,
    followUpCandidate,
    reason,
  };
}

function buildScopeMetadata(params: {
  tag: ScopeTag;
  reason: ScopeReason;
  keywordMatch: boolean;
  greetingMatch: boolean;
  followUpCandidate: boolean;
  contextType: string | null;
}): Record<string, unknown> {
  return {
    [SCOPE_METADATA_KEY]: {
      version: 1,
      tag: params.tag,
      reason: params.reason,
      keywordMatch: params.keywordMatch,
      greetingMatch: params.greetingMatch,
      followUpCandidate: params.followUpCandidate,
      contextType: params.contextType,
    },
  };
}

function entryIsInScope(entry: ScopeHistoryEntry): boolean {
  const tag = readScopeTag(entry.metadata);
  if (tag === "in-app") {
    return true;
  }
  if (tag === "out-of-scope") {
    return false;
  }
  const normalized = normalizeScopeText(entry.text ?? "");
  if (!normalized) {
    return false;
  }
  return matchesKeyword(normalized);
}

function readScopeTag(
  metadata?: Record<string, unknown> | null,
): ScopeTag | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const scope = metadata[SCOPE_METADATA_KEY];
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return null;
  }
  const tag = (scope as { tag?: unknown }).tag;
  if (tag === "in-app" || tag === "out-of-scope") {
    return tag;
  }
  return null;
}

function matchesKeyword(normalizedText: string): boolean {
  return IN_SCOPE_KEYWORDS.some((keyword) => normalizedText.includes(keyword));
}

function normalizeScopeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGreeting(text: string): boolean {
  const normalized = normalizeScopeText(text);
  if (!normalized) {
    return false;
  }
  const tokens = normalized.split(" ").filter(Boolean);
  if (!tokens.length) {
    return false;
  }
  if (!GREETING_WORDS.has(tokens[0])) {
    return false;
  }
  if (tokens.length === 1) {
    return true;
  }
  return tokens
    .slice(1)
    .every(
      (token) =>
        GREETING_WORDS.has(token) ||
        ACK_WORDS.has(token) ||
        QUESTION_WORDS.has(token) ||
        GREETING_FILLERS.has(token) ||
        token.length <= 3,
    );
}

function looksLikeFollowUp(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = trimmed
    .replace(/’/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!normalized) {
    return false;
  }

  const ackCandidate = normalized
    .replace(/['’]/g, "")
    .replace(/[!.?,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (ackCandidate) {
    const tokens = ackCandidate.split(" ").filter(Boolean);
    const hasQuestionWord = tokens.some((token) => QUESTION_WORDS.has(token));
    if (
      tokens.length &&
      !hasQuestionWord &&
      !normalized.includes("?") &&
      tokens.every((token) => ACK_WORDS.has(token))
    ) {
      return true;
    }
  }

  return FOLLOW_UP_COMMAND_REGEX.test(normalized);
}
