"use client";

import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { clsx } from "clsx";
import {
  Archive,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCheck,
  FileText,
  Filter,
  Forward,
  Inbox,
  MessageSquare,
  Paperclip,
  PenSquare,
  RefreshCw,
  Reply,
  Search,
  Eye,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";

export type ClientSummary = {
  id: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  address: string | null;
};

export type InvoiceSummary = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  totalCents: number;
  currency: string;
  issueDate: string;
  status: string;
};

export type QuoteSummary = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  totalCents: number;
  currency: string;
  issueDate: string;
  status: string;
};

export type AuditLogEntry = {
  id: string;
  documentType: string;
  documentId: string;
  to: string;
  subject: string;
  body: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
  error: string | null;
};

type CompanySummary = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type MailFolder = "inbox" | "sent" | "drafts" | "archived" | "spam";

type MailDirection = "incoming" | "outgoing";

type MailStatus = "ENVOYE" | "ECHEC" | "EN_ATTENTE" | "BROUILLON";

type MessagerieTab = "mailbox" | "templates" | "accounts" | "activity";

type RelatedEntity =
  | { type: "client"; id: string }
  | { type: "invoice"; id: string }
  | { type: "quote"; id: string }
  | null;

type MailAttachment = {
  id: string;
  name: string;
  size: number;
  inline: boolean;
};

type MailAuditTrace = {
  id: string;
  label: string;
  timestamp: string;
};

type MailMessage = {
  id: string;
  direction: MailDirection;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  createdAt: string;
  attachments: MailAttachment[];
  status: MailStatus;
  priority: "normal" | "high";
  scheduledFor: string | null;
  tracking: {
    opens: boolean;
    readReceipt: boolean;
  };
  auditTrail: MailAuditTrace[];
};

type MailThread = {
  id: string;
  accountId: string;
  subject: string;
  folder: MailFolder;
  labels: string[];
  preview: string;
  updatedAt: string;
  relatedEntity: RelatedEntity;
  messages: MailMessage[];
};

type MailLabel = {
  id: string;
  name: string;
  color: string;
};

type MailAccount = {
  id: string;
  label: string;
  email: string;
  imap: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
  };
  signature: string;
  automations: {
    followUps: boolean;
    autoArchive: boolean;
    linkDocuments: boolean;
  };
};

type TemplateCategory = "nouveau" | "relance" | "remerciement" | "reponse";

type MailTemplate = {
  id: string;
  accountId: string | null;
  name: string;
  subject: string;
  body: string;
  category: TemplateCategory;
  quickReply: boolean;
};

type MailComposerState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: MailAttachment[];
  sending: boolean;
  error: string | null;
  includeSignature: boolean;
  trackOpens: boolean;
  requestReadReceipt: boolean;
  scheduleSend: boolean;
  scheduleAt: string;
  priority: "normal" | "high";
};

type PermissionState = {
  view: boolean;
  send: boolean;
  manageTemplates: boolean;
  manageAccounts: boolean;
};

type MessagerieWorkspaceProps = {
  clients: ClientSummary[];
  invoices: InvoiceSummary[];
  quotes: QuoteSummary[];
  auditLogs: AuditLogEntry[];
  company: CompanySummary;
};

const FOLDERS: { id: MailFolder; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "inbox", label: "Boîte de réception", icon: Inbox },
  { id: "sent", label: "Envoyés", icon: Send },
  { id: "drafts", label: "Brouillons", icon: PenSquare },
  { id: "archived", label: "Archivés", icon: Archive },
  { id: "spam", label: "Spam", icon: Trash2 },
];

const MESSAGERIE_TABS: {
  id: MessagerieTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    id: "mailbox",
    label: "Conversations",
    icon: Inbox,
    description: "Filtrer, consulter et répondre aux conversations",
  },
  {
    id: "templates",
    label: "Modèles",
    icon: FileText,
    description: "Gérer les modèles prêts à l'envoi",
  },
  {
    id: "accounts",
    label: "Comptes",
    icon: Settings,
    description: "Configurer les boîtes connectées",
  },
  {
    id: "activity",
    label: "Journal",
    icon: CalendarClock,
    description: "Historique des envois et événements",
  },
];

const TEMPLATE_CATEGORY_METADATA: Record<TemplateCategory, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  nouveau: {
    label: "Nouveau message",
    description: "Premier contact ou accompagnement",
    icon: Sparkles,
  },
  relance: {
    label: "Relance",
    description: "Suivi automatique des factures",
    icon: RefreshCw,
  },
  remerciement: {
    label: "Remerciement",
    description: "Confirmez la bonne réception d'un règlement",
    icon: MessageSquare,
  },
  reponse: {
    label: "Réponse rapide",
    description: "Accusez réception en un clic",
    icon: Reply,
  },
};

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "nouveau",
  "relance",
  "remerciement",
  "reponse",
];

const STATUS_FILTERS: { id: MailStatus | "all"; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "ENVOYE", label: "Envoyé" },
  { id: "EN_ATTENTE", label: "En attente" },
  { id: "ECHEC", label: "Échec" },
  { id: "BROUILLON", label: "Brouillon" },
];

const TEMPLATE_CATEGORY_FILTERS: (TemplateCategory | "all")[] = [
  "all",
  ...TEMPLATE_CATEGORIES,
];

const DEFAULT_PERMISSIONS: PermissionState = {
  view: true,
  send: true,
  manageTemplates: true,
  manageAccounts: false,
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildInitialAccounts(company: CompanySummary): MailAccount[] {
  return [
    {
      id: "compte-principal",
      label: "Compte principal",
      email: company.email ?? "facturation@example.com",
      imap: {
        host: "imap.exemple.com",
        port: 993,
        secure: true,
        username: company.email ?? "facturation@example.com",
      },
      smtp: {
        host: "smtp.exemple.com",
        port: 465,
        secure: true,
        username: company.email ?? "facturation@example.com",
      },
      signature: `Cordialement,\n${company.name}\n${company.phone ?? "Tél. +216 00 000 000"}`,
      automations: {
        followUps: true,
        autoArchive: false,
        linkDocuments: true,
      },
    },
    {
      id: "support",
      label: "Support & relances",
      email: "support@example.com",
      imap: {
        host: "imap.example.net",
        port: 993,
        secure: true,
        username: "support@example.com",
      },
      smtp: {
        host: "smtp.example.net",
        port: 587,
        secure: false,
        username: "support@example.com",
      },
      signature:
        "Service support\nDisponible du lundi au vendredi\nhttps://example.com",
      automations: {
        followUps: true,
        autoArchive: true,
        linkDocuments: true,
      },
    },
  ];
}
function buildInitialTemplates(company: CompanySummary): MailTemplate[] {
  const companyName = company.name ?? "notre équipe";
  const contactLine = company.email
    ? `Vous pouvez nous écrire à ${company.email}.`
    : "Nous restons à votre disposition.";

  return [
    {
      id: "template-devis",
      accountId: "compte-principal",
      name: "Envoi d'un devis",
      subject: "Votre devis {{devis.numero}}",
      body: `Bonjour {{client.nom}},\n\nMerci pour votre confiance envers ${companyName}. Vous trouverez ci-joint le devis {{devis.numero}} du {{devis.date}} pour un montant de {{devis.total}}.\n${contactLine}\n\n{{signature}}`,
      category: "nouveau",
      quickReply: false,
    },
    {
      id: "template-facture",
      accountId: "compte-principal",
      name: "Relance facture",
      subject: "Rappel : facture {{facture.numero}}",
      body:
        "Bonjour {{client.nom}},\n\nNous revenons vers vous concernant la facture {{facture.numero}} émise le {{facture.date}} pour un montant de {{facture.total}}. Merci de nous tenir informés de la date de règlement.\n\nBien cordialement,\n{{signature}}",
      category: "relance",
      quickReply: true,
    },
    {
      id: "template-remerciement",
      accountId: null,
      name: "Remerciement client",
      subject: "Merci pour votre règlement",
      body:
        "Bonjour {{client.nom}},\n\nNous vous remercions pour le paiement de {{facture.total}} lié à la facture {{facture.numero}}. Nous restons à votre disposition pour toute nouvelle demande.\n\nExcellente journée !\n{{signature}}",
      category: "remerciement",
      quickReply: true,
    },
    {
      id: "template-support",
      accountId: "support",
      name: "Réponse rapide support",
      subject: "Re: {{objet}}",
      body:
        "Bonjour {{client.nom}},\n\nMerci pour votre message. Nous analysons votre demande et reviendrons vers vous sous 24h.\n\n--\nRéponse automatique générée le {{date}}\n{{signature}}",
      category: "reponse",
      quickReply: true,
    },
  ];
}

function buildInitialLabels(): MailLabel[] {
  return [
    { id: "urgent", name: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200" },
    { id: "suivi", name: "Suivi", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
    { id: "comptabilite", name: "Comptabilité", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
  ];
}

function buildInitialThreads(
  accounts: MailAccount[],
  clients: ClientSummary[],
  invoices: InvoiceSummary[],
  quotes: QuoteSummary[],
): MailThread[] {
  const client = clients[0];
  const invoice = invoices[0];
  const quote = quotes[0];
  const account = accounts[0];
  const now = new Date();
  const baseDate = now.toISOString();
  const makeAudit = (label: string, offsetMinutes: number): MailAuditTrace => ({
    id: makeId("audit"),
    label,
    timestamp: new Date(now.getTime() - offsetMinutes * 60 * 1000).toISOString(),
  });

  return [
    {
      id: "thread-1",
      accountId: account.id,
      subject: quote ? `Demande sur devis ${quote.number}` : "Question client",
      folder: "inbox",
      labels: ["suivi"],
      preview:
        "Bonjour, pourriez-vous me renvoyer le devis signé ? Merci d'avance.",
      updatedAt: baseDate,
      relatedEntity: quote ? { type: "quote", id: quote.id } : null,
      messages: [
        {
          id: "message-1",
          direction: "incoming",
          from: client?.email ?? "client@example.com",
          to: [account.email],
          cc: [],
          bcc: [],
          subject: quote ? `Demande sur devis ${quote.number}` : "Question",
          body:
            "Bonjour,\n\nPourriez-vous me renvoyer la dernière version du devis ?\nMerci beaucoup.\n\nCordialement,",
          createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          attachments: [],
          status: "ENVOYE",
          priority: "normal",
          scheduledFor: null,
          tracking: { opens: false, readReceipt: false },
          auditTrail: [
            makeAudit("Reçu sur le serveur", 30),
            makeAudit("Attribué au dossier Boîte de réception", 29),
          ],
        },
      ],
    },
    {
      id: "thread-2",
      accountId: account.id,
      subject: invoice
        ? `Suivi règlement facture ${invoice.number}`
        : "Relance paiement",
      folder: "sent",
      labels: ["comptabilite"],
      preview:
        "Bonjour, nous revenons vers vous concernant la facture en attente de paiement.",
      updatedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      relatedEntity: invoice ? { type: "invoice", id: invoice.id } : null,
      messages: [
        {
          id: "message-2",
          direction: "outgoing",
          from: account.email,
          to: [client?.email ?? "client@example.com"],
          cc: [],
          bcc: [],
          subject: invoice
            ? `Suivi règlement facture ${invoice.number}`
            : "Relance paiement",
          body:
            "Bonjour,\n\nNous revenons vers vous au sujet de la facture en attente de règlement. Merci de nous confirmer la date de paiement.\n\nBien cordialement,",
          createdAt: new Date(now.getTime() - 65 * 60 * 1000).toISOString(),
          attachments: [],
          status: "ENVOYE",
          priority: "normal",
          scheduledFor: null,
          tracking: { opens: true, readReceipt: false },
          auditTrail: [
            makeAudit("Envoyé via SMTP", 65),
            makeAudit("Ouvert par le destinataire", 32),
          ],
        },
      ],
    },
    {
      id: "thread-3",
      accountId: accounts[1]?.id ?? account.id,
      subject: "Demande de support sur le portail client",
      folder: "drafts",
      labels: [],
      preview:
        "Merci pour votre message, notre équipe prend en charge votre demande...",
      updatedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      relatedEntity: client ? { type: "client", id: client.id } : null,
      messages: [
        {
          id: "message-3",
          direction: "outgoing",
          from: accounts[1]?.email ?? account.email,
          to: [client?.email ?? "client@example.com"],
          cc: [],
          bcc: [],
          subject: "Demande de support sur le portail client",
          body:
            "Bonjour {{client.nom}},\n\nMerci pour votre message. Nous analysons votre demande.\n\nCeci est un brouillon prêt à être envoyé.",
          createdAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
          attachments: [],
          status: "BROUILLON",
          priority: "normal",
          scheduledFor: null,
          tracking: { opens: false, readReceipt: false },
          auditTrail: [makeAudit("Brouillon enregistré", 10)],
        },
      ],
    },
  ];
}

const LABEL_COLORS = [
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-200",
];

function pickLabelColor(index: number) {
  return LABEL_COLORS[index % LABEL_COLORS.length];
}

function renderTemplate(
  template: string,
  context: Record<string, string>,
  signature: string,
) {
  let rendered = template;
  const variables = new Set(
    [...template.matchAll(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g)].map((match) => match[1]),
  );
  variables.forEach((variable) => {
    const value =
      variable === "signature"
        ? signature
        : context[variable] ?? `{{${variable}}}`;
    rendered = rendered.replace(
      new RegExp(`{{\\s*${variable.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*}}`, "g"),
      value,
    );
  });
  return rendered;
}

function formatBytes(size: number) {
  if (size === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const order = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** order;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)}\u00a0${units[order]}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNewlines(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function ensureSignature(body: string, signature: string) {
  if (!signature) return body;
  const normalizedSignature = normalizeNewlines(signature).trim();
  if (!normalizedSignature) return body;
  const normalizedBody = normalizeNewlines(body).replace(/\s+$/, "");
  if (normalizedBody.endsWith(normalizedSignature)) {
    return normalizedBody;
  }
  if (normalizedBody.length === 0) {
    return normalizedSignature;
  }
  return `${normalizedBody}\n\n${normalizedSignature}`;
}

function stripSignature(body: string, signature: string) {
  if (!signature) return body;
  const normalizedSignature = normalizeNewlines(signature).trim();
  if (!normalizedSignature) return body;
  const regex = new RegExp(`\\n*${escapeRegExp(normalizedSignature)}\\s*$`);
  return normalizeNewlines(body).replace(regex, "").replace(/\s+$/, "");
}

const PROFESSIONAL_EMAIL_TEMPLATE = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6fb;padding:32px 0;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <tr>
          <td style="padding:32px;background:linear-gradient(135deg,#2563eb,#0ea5e9);color:#ffffff;">
            <h1 style="margin:0;font-size:24px;font-weight:600;">Suivi de {{societe.nom}}</h1>
            <p style="margin:8px 0 0;font-size:16px;opacity:0.9;">Facture {{facture.numero}} - {{facture.total}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="font-size:16px;margin:0 0 16px;">Bonjour {{client.nom}},</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
              Nous espérons que tout va bien. Ce message concerne la facture <strong>{{facture.numero}}</strong> émise le {{facture.date}} pour un montant de <strong>{{facture.total}}</strong>.
            </p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
              Si le règlement a déjà été effectué, merci d'ignorer ce message. Dans le cas contraire, vous pouvez régler votre solde directement depuis votre espace client.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0;background:#f8fafc;border-radius:12px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#2563eb;font-weight:600;">Informations clés</p>
                  <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.5;">
                    • Échéance : <strong>{{facture.date}}</strong><br/>
                    • Statut actuel : <strong>{{facture.statut}}</strong><br/>
                    • Contact : <strong>{{societe.email}}</strong>
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
              Notre équipe reste disponible pour toute question au {{societe.telephone}} ou par retour de mail. Merci pour votre confiance !
            </p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#1e293b;">{{signature}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;background:#0f172a;color:#e2e8f0;font-size:12px;text-align:center;">
            {{societe.nom}} · {{societe.adresse}} · {{societe.email}}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;
export function MessagerieWorkspace({
  clients,
  invoices,
  quotes,
  auditLogs,
  company,
}: MessagerieWorkspaceProps) {
  const { addToast } = useToast();
  const initialAccounts = useMemo(() => buildInitialAccounts(company), [company]);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccounts[0]?.id ?? "");
  const [templates] = useState(() => buildInitialTemplates(company));
  const [labels, setLabels] = useState(() => buildInitialLabels());
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [activeTab, setActiveTab] = useState<MessagerieTab>("mailbox");
  const [threadQuery, setThreadQuery] = useState("");
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MailStatus | "all">("all");
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | "all">("all");
  const [templateQuery, setTemplateQuery] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [threads, setThreads] = useState(() =>
    buildInitialThreads(initialAccounts, clients, invoices, quotes),
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    threads[0]?.id ?? null,
  );
  const [linkedEntity, setLinkedEntity] = useState<RelatedEntity>(
    threads[0]?.relatedEntity ?? null,
  );
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [composer, setComposer] = useState<MailComposerState>(() => {
    const defaultSignature = initialAccounts[0]?.signature ?? "";
    return {
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: defaultSignature ? `\n\n${defaultSignature}` : "",
      attachments: [],
      sending: false,
      error: null,
      includeSignature: Boolean(defaultSignature),
      trackOpens: true,
      requestReadReceipt: false,
      scheduleSend: false,
      scheduleAt: "",
      priority: "normal",
    };
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  const canManageAccounts = permissions.manageAccounts;
  const canManageTemplates = permissions.manageTemplates;

  const relatedContext = useMemo(() => {
    const context: Record<string, string> = {
      date: formatDate(new Date(), "fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      objet: threads.find((thread) => thread.id === selectedThreadId)?.subject ?? "",
      "societe.nom": company.name,
    };
    if (company.email) context["societe.email"] = company.email;
    if (company.phone) context["societe.telephone"] = company.phone;
    if (company.address) context["societe.adresse"] = company.address;

    if (linkedEntity) {
      if (linkedEntity.type === "client") {
        const client = clients.find((item) => item.id === linkedEntity.id);
        if (client) {
          context["client.nom"] = client.displayName;
          if (client.email) context["client.email"] = client.email;
          if (client.phone) context["client.telephone"] = client.phone;
          if (client.vatNumber) context["client.tva"] = client.vatNumber;
          if (client.address) context["client.adresse"] = client.address;
          if (client.companyName) context["client.entreprise"] = client.companyName;
        }
      }
      if (linkedEntity.type === "invoice") {
        const invoice = invoices.find((item) => item.id === linkedEntity.id);
        if (invoice) {
          const amount = formatCurrency(
            fromCents(invoice.totalCents, invoice.currency),
            invoice.currency,
          );
          context["facture.numero"] = invoice.number;
          context["facture.total"] = amount;
          context["facture.date"] = formatDate(invoice.issueDate);
          context["facture.statut"] = invoice.status;
          const client = clients.find((item) => item.id === invoice.clientId);
          if (client) {
            context["client.nom"] = client.displayName;
            if (client.email) context["client.email"] = client.email;
          }
        }
      }
      if (linkedEntity.type === "quote") {
        const quote = quotes.find((item) => item.id === linkedEntity.id);
        if (quote) {
          const amount = formatCurrency(
            fromCents(quote.totalCents, quote.currency),
            quote.currency,
          );
          context["devis.numero"] = quote.number;
          context["devis.total"] = amount;
          context["devis.date"] = formatDate(quote.issueDate);
          context["devis.statut"] = quote.status;
          const client = clients.find((item) => item.id === quote.clientId);
          if (client) {
            context["client.nom"] = client.displayName;
            if (client.email) context["client.email"] = client.email;
          }
        }
      }
    }

    return context;
  }, [
    clients,
    company.address,
    company.email,
    company.name,
    company.phone,
    invoices,
    linkedEntity,
    quotes,
    selectedThreadId,
    threads,
  ]);

  const availableVariables = useMemo(() => {
    return Object.entries(relatedContext).map(([key, value]) => ({
      key,
      value,
    }));
  }, [relatedContext]);

  const professionalTemplate = useMemo(() => {
    const signature = composer.includeSignature ? selectedAccount?.signature ?? "" : "";
    return renderTemplate(PROFESSIONAL_EMAIL_TEMPLATE, relatedContext, signature);
  }, [composer.includeSignature, relatedContext, selectedAccount?.signature]);

  const visibleAccounts = useMemo(() => {
    const query = accountQuery.trim().toLowerCase();
    if (query.length === 0) {
      return accounts;
    }
    return accounts.filter((account) =>
      [account.label, account.email]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [accountQuery, accounts]);

  const templatesForSelectedAccount = useMemo(() => {
    if (!selectedAccount) return templates;
    return templates.filter(
      (template) => !template.accountId || template.accountId === selectedAccount.id,
    );
  }, [selectedAccount, templates]);

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    return templatesForSelectedAccount.filter((template) => {
      const matchesCategory =
        templateCategory === "all" || template.category === templateCategory;
      const matchesQuery =
        query.length === 0 ||
        [template.name, template.subject, template.body]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [templateCategory, templateQuery, templatesForSelectedAccount]);

  const quickTemplates = useMemo(
    () => templatesForSelectedAccount.filter((template) => template.quickReply),
    [templatesForSelectedAccount],
  );

  const templatesByCategory = useMemo(() => {
    const groups: Record<TemplateCategory, MailTemplate[]> = {
      nouveau: [],
      relance: [],
      remerciement: [],
      reponse: [],
    };
    filteredTemplates.forEach((template) => {
      groups[template.category].push(template);
    });
    return groups;
  }, [filteredTemplates]);

  const filteredAuditLogs = useMemo(() => {
    const query = auditQuery.trim().toLowerCase();
    return auditLogs
      .filter((log) =>
        query.length === 0
          ? true
          : [log.subject, log.to, log.status, log.body ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(query),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [auditLogs, auditQuery]);

  const auditStatusSummary = useMemo(() => {
    return filteredAuditLogs.reduce(
      (acc, log) => {
        if (log.status === "ENVOYE" || log.status === "ECHEC" || log.status === "EN_ATTENTE" || log.status === "BROUILLON") {
          acc[log.status] = (acc[log.status] ?? 0) + 1;
        }
        return acc;
      },
      { ENVOYE: 0, ECHEC: 0, EN_ATTENTE: 0, BROUILLON: 0 } as Record<MailStatus, number>,
    );
  }, [filteredAuditLogs]);

  const filteredThreads = useMemo(() => {
    const lowerSearch = threadQuery.trim().toLowerCase();
    return threads
      .filter((thread) =>
        thread.accountId === selectedAccount?.id &&
        thread.folder === folder &&
        (labelFilter ? thread.labels.includes(labelFilter) : true) &&
        (statusFilter === "all"
          ? true
          : thread.messages.some((message) => message.status === statusFilter)) &&
        (lowerSearch.length === 0
          ? true
          : [thread.subject, thread.preview]
              .join(" ")
              .toLowerCase()
              .includes(lowerSearch)),
      )
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [
    folder,
    labelFilter,
    threadQuery,
    selectedAccount?.id,
    statusFilter,
    threads,
  ]);

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;

  function handleAccountChange(accountId: string) {
    const currentAccount = selectedAccount;
    const nextAccount =
      accounts.find((account) => account.id === accountId) ?? accounts[0];
    setSelectedAccountId(accountId);
    if (nextAccount) {
      setComposer((current) => {
        if (!current.includeSignature) {
          return current;
        }
        const previousSignature = currentAccount?.signature ?? "";
        const nextSignature = nextAccount.signature ?? "";
        return {
          ...current,
          body: ensureSignature(stripSignature(current.body, previousSignature), nextSignature),
        };
      });
    }
    const nextThread = threads.find(
      (thread) => thread.accountId === accountId && thread.folder === folder,
    );
    setSelectedThreadId(nextThread?.id ?? null);
  }

  function moveSelectedThread(
    targetFolder: MailFolder,
    toastTitle: string,
    toastDescription: string,
  ) {
    if (!selectedThread) {
      return;
    }

    setThreads((current) =>
      current.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              folder: targetFolder,
              updatedAt: new Date().toISOString(),
            }
          : thread,
      ),
    );
    setFolder(targetFolder);
    setSelectedThreadId(selectedThread.id);
    addToast({
      variant: "info",
      title: toastTitle,
      description: toastDescription,
    });
  }

  function handleArchiveSelectedThread() {
    moveSelectedThread(
      "archived",
      "Conversation archivée",
      "Le fil est disponible dans les archives.",
    );
  }

  function handleMarkAsSpam() {
    moveSelectedThread(
      "spam",
      "Conversation supprimée",
      "Le fil a été déplacé dans le dossier spam.",
    );
  }
  function updateAccountField(accountId: string, field: keyof MailAccount, value: unknown) {
    setAccounts((current) =>
      current.map((account) =>
        account.id === accountId
          ? { ...account, [field]: value }
          : account,
      ),
    );
  }

  function updateNestedAccountField(
    accountId: string,
    key: "imap" | "smtp",
    field: keyof MailAccount[typeof key],
    value: unknown,
  ) {
    setAccounts((current) =>
      current.map((account) =>
        account.id === accountId
          ? {
              ...account,
              [key]: {
                ...account[key],
                [field]: value,
              },
            }
          : account,
      ),
    );
  }

  function toggleAutomation(accountId: string, field: keyof MailAccount["automations"]) {
    setAccounts((current) =>
      current.map((account) =>
        account.id === accountId
          ? {
              ...account,
              automations: {
                ...account.automations,
                [field]: !account.automations[field],
              },
            }
          : account,
      ),
    );
  }

  function addLabel(name: string) {
    if (!name.trim()) {
      return;
    }
    setLabels((current) => {
      if (current.some((label) => label.name.toLowerCase() === name.toLowerCase())) {
        return current;
      }
      const id = makeId("label");
      const color = pickLabelColor(current.length);
      return [...current, { id, name, color }];
    });
    addToast({
      variant: "success",
      title: "Étiquette créée",
      description: `L'étiquette "${name}" est disponible pour le classement.`,
    });
  }

  function toggleLabelOnThread(threadId: string, labelId: string) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              labels: thread.labels.includes(labelId)
                ? thread.labels.filter((id) => id !== labelId)
                : [...thread.labels, labelId],
            }
          : thread,
      ),
    );
  }

  function linkThreadToEntity(threadId: string, entity: RelatedEntity) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              relatedEntity: entity,
            }
          : thread,
      ),
    );
    setLinkedEntity(entity);
    addToast({
      variant: "success",
      title: "Conversation liée",
      description: entity
        ? "Le fil est maintenant rattaché à l'entité sélectionnée."
        : "Le lien a été supprimé.",
    });
  }

  function handleInsertTemplate(template: MailTemplate) {
    if (!selectedAccount) {
      addToast({ variant: "error", title: "Aucun compte sélectionné" });
      return;
    }
    if (!permissions.manageTemplates) {
      addToast({
        variant: "warning",
        title: "Accès restreint",
        description: "Vous n'avez pas l'autorisation de gérer les modèles.",
      });
      return;
    }
    const rendered = renderTemplate(template.body, relatedContext, selectedAccount.signature);
    setComposer((current) => ({
      ...current,
      subject: current.subject || renderTemplate(template.subject, relatedContext, selectedAccount.signature),
      body: current.body ? `${current.body}\n\n${rendered}` : rendered,
    }));
    addToast({
      variant: "success",
      title: "Modèle inséré",
      description: `Le modèle "${template.name}" a été ajouté à votre message.`,
    });
  }

  function handleApplyProfessionalTemplate() {
    if (!selectedAccount) {
      addToast({ variant: "error", title: "Aucun compte sélectionné" });
      return;
    }
    const signature = composer.includeSignature ? selectedAccount.signature : "";
    const rendered = renderTemplate(PROFESSIONAL_EMAIL_TEMPLATE, relatedContext, signature);
    setComposer((current) => ({
      ...current,
      subject: current.subject || "Suivi de facture",
      body: rendered,
      error: null,
    }));
    addToast({
      variant: "success",
      title: "Modèle professionnel appliqué",
      description: "Le message a été remplacé par la mise en page HTML professionnelle.",
    });
  }

  function handleInsertVariable(variable: string) {
    setComposer((current) => {
      const textarea = bodyRef.current;
      if (!textarea) {
        return { ...current, body: `${current.body}{{${variable}}}` };
      }
      const { selectionStart, selectionEnd } = textarea;
      const nextBody =
        current.body.slice(0, selectionStart) +
        `{{${variable}}}` +
        current.body.slice(selectionEnd);
      requestAnimationFrame(() => {
        textarea.focus();
        const position = selectionStart + variable.length + 4;
        textarea.setSelectionRange(position, position);
      });
      return { ...current, body: nextBody };
    });
  }

  function handleAddAttachment(fileList: FileList | null) {
    if (!fileList || !permissions.send) return;
    setComposer((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        ...Array.from(fileList).map((file) => ({
          id: makeId("att"),
          name: file.name,
          size: file.size,
          inline: file.type.startsWith("image/"),
        })),
      ],
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleAttachmentDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!permissions.send) {
      return;
    }
    if (event.dataTransfer?.files) {
      handleAddAttachment(event.dataTransfer.files);
    }
  }

  function toggleAttachmentInline(attachmentId: string) {
    setComposer((current) => ({
      ...current,
      attachments: current.attachments.map((attachment) =>
        attachment.id === attachmentId
          ? { ...attachment, inline: !attachment.inline }
          : attachment,
      ),
    }));
  }

  function removeAttachment(attachmentId: string) {
    setComposer((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  }

  function resetComposer() {
    setComposer((current) => {
      const signature = selectedAccount?.signature ?? "";
      const includeSignature = current.includeSignature && Boolean(signature);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return {
        ...current,
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: includeSignature ? `\n\n${signature}` : "",
        attachments: [],
        sending: false,
        error: null,
        includeSignature,
        scheduleSend: false,
        scheduleAt: "",
        priority: "normal",
      };
    });
  }

  function prepareReply(direction: "reply" | "forward") {
    if (!selectedThread) return;
    const lastMessage = [...selectedThread.messages].sort((a, b) =>
      a.createdAt > b.createdAt ? -1 : 1,
    )[0];
    if (!lastMessage) return;
    setComposer((current) => {
      const signature = current.includeSignature ? selectedAccount?.signature ?? "" : "";
      const baseBody =
        direction === "reply"
          ? `\n\n----- Message d'origine -----\n${lastMessage.body}`
          : `\n\n----- Transfert -----\n${lastMessage.body}`;
      return {
        ...current,
        to:
          direction === "reply"
            ? lastMessage.direction === "incoming"
              ? lastMessage.from
              : lastMessage.to.join(", ")
            : "",
        cc: direction === "forward" ? lastMessage.to.join(", ") : "",
        bcc: "",
        subject:
          direction === "reply"
            ? lastMessage.subject.startsWith("Re:")
              ? lastMessage.subject
              : `Re: ${lastMessage.subject}`
            : lastMessage.subject.startsWith("TR:")
            ? lastMessage.subject
            : `TR: ${lastMessage.subject}`,
        body: current.includeSignature ? ensureSignature(baseBody, signature) : baseBody,
        attachments:
          direction === "forward"
            ? lastMessage.attachments.map((attachment) => ({ ...attachment }))
            : [],
        sending: false,
        error: null,
      };
    });
  }
  function handleSendMessage() {
    if (!selectedAccount) {
      addToast({ variant: "error", title: "Aucun compte sélectionné" });
      return;
    }
    if (!permissions.send) {
      addToast({ variant: "error", title: "Envoi non autorisé" });
      setComposer((current) => ({ ...current, error: "Vous n'avez pas les droits pour envoyer." }));
      return;
    }
    if (!composer.to.trim()) {
      addToast({ variant: "error", title: "Destinataire manquant" });
      setComposer((current) => ({ ...current, error: "Veuillez renseigner au moins un destinataire." }));
      return;
    }
    if (!composer.subject.trim()) {
      addToast({ variant: "error", title: "Sujet obligatoire" });
      setComposer((current) => ({ ...current, error: "Le sujet est requis pour l'envoi." }));
      return;
    }

    const wantsScheduling = composer.scheduleSend;
    let scheduleDate: Date | null = null;

    if (wantsScheduling) {
      const scheduleInput = composer.scheduleAt.trim();

      if (!scheduleInput) {
        addToast({ variant: "error", title: "Date de planification requise" });
        setComposer((current) => ({
          ...current,
          sending: false,
          error: "Veuillez indiquer une date et une heure pour planifier l'envoi.",
        }));
        return;
      }

      const parsedScheduleDate = new Date(scheduleInput);
      if (Number.isNaN(parsedScheduleDate.getTime())) {
        addToast({ variant: "error", title: "Date de planification invalide" });
        setComposer((current) => ({
          ...current,
          sending: false,
          error: "La date de planification saisie est invalide. Vérifiez le format.",
        }));
        return;
      }

      scheduleDate = parsedScheduleDate;
    }

    const currentComposer = composer;
    setComposer((current) => ({ ...current, sending: true, error: null }));
    const attachments = currentComposer.attachments.map((attachment) => ({ ...attachment }));
    const signature = currentComposer.includeSignature ? selectedAccount.signature : "";
    const rawBody = renderTemplate(currentComposer.body, relatedContext, signature);
    const previewText = rawBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const now = new Date();
    const hasSchedule = !!scheduleDate;
    const scheduledFor = hasSchedule ? scheduleDate.toISOString() : null;
    const status: MailStatus = scheduledFor ? "EN_ATTENTE" : "ENVOYE";
    const createdAt = now.toISOString();
    const auditTrail: MailAuditTrace[] = [
      {
        id: makeId("audit"),
        label: scheduledFor
          ? `Planifié pour ${DATE_TIME_FORMATTER.format(new Date(scheduledFor))}`
          : "Message en file d'attente",
        timestamp: createdAt,
      },
    ];
    if (!scheduledFor) {
      auditTrail.push({
        id: makeId("audit"),
        label: "Transmis au serveur SMTP",
        timestamp: createdAt,
      });
    }
    if (currentComposer.trackOpens) {
      auditTrail.push({
        id: makeId("audit"),
        label: "Suivi des ouvertures activé",
        timestamp: createdAt,
      });
    }
    if (currentComposer.requestReadReceipt) {
      auditTrail.push({
        id: makeId("audit"),
        label: "Accusé de lecture demandé",
        timestamp: createdAt,
      });
    }
    const newMessage: MailMessage = {
      id: makeId("msg"),
      direction: "outgoing",
      from: selectedAccount.email,
      to: currentComposer.to.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      cc: currentComposer.cc.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      bcc: currentComposer.bcc.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      subject: currentComposer.subject,
      body: rawBody,
      createdAt,
      attachments,
      status,
      priority: currentComposer.priority,
      scheduledFor,
      tracking: {
        opens: currentComposer.trackOpens,
        readReceipt: currentComposer.requestReadReceipt,
      },
      auditTrail,
    };

    const threadId = selectedThread?.id ?? makeId("thread");
    const isNewThread = !selectedThread;

    setThreads((current) => {
      if (isNewThread) {
        return [
          {
            id: threadId,
            accountId: selectedAccount.id,
            subject: currentComposer.subject,
            folder: "sent",
            labels: linkedEntity ? ["suivi"] : [],
            preview: previewText.slice(0, 120),
            updatedAt: newMessage.createdAt,
            relatedEntity: linkedEntity,
            messages: [newMessage],
          },
          ...current,
        ];
      }
      return current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              folder: thread.folder === "drafts" ? "sent" : thread.folder,
              preview: previewText.slice(0, 120),
              updatedAt: newMessage.createdAt,
              messages: [...thread.messages, newMessage],
            }
          : thread,
      );
    });

    addToast({
      variant: "success",
      title: scheduledFor ? "Envoi planifié" : "E-mail prêt",
      description: scheduledFor
        ? `Le message sera envoyé le ${DATE_TIME_FORMATTER.format(new Date(scheduledFor))}.`
        : `Votre message a été transmis via ${selectedAccount.smtp.host}:${selectedAccount.smtp.port}. ${
            currentComposer.trackOpens ? "Le suivi des ouvertures est actif." : ""
          }`,
    });

    resetComposer();
    setSelectedThreadId(threadId);
    setFolder("sent");
    setShowAdvancedOptions(false);
  }
  function handleSaveDraft() {
    if (!selectedAccount) return;
    const currentComposer = composer;
    const attachments = currentComposer.attachments.map((attachment) => ({ ...attachment }));
    const previewText = currentComposer.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const scheduleDate =
      currentComposer.scheduleSend && currentComposer.scheduleAt
        ? new Date(currentComposer.scheduleAt)
        : null;
    const hasSchedule = !!scheduleDate && !Number.isNaN(scheduleDate.getTime());
    const scheduledFor = hasSchedule ? scheduleDate.toISOString() : null;
    const newMessage: MailMessage = {
      id: makeId("draft"),
      direction: "outgoing",
      from: selectedAccount.email,
      to: currentComposer.to.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      cc: currentComposer.cc.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      bcc: currentComposer.bcc.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      subject: currentComposer.subject || "(Sans objet)",
      body: currentComposer.body,
      createdAt: new Date().toISOString(),
      attachments,
      status: "BROUILLON",
      priority: currentComposer.priority,
      scheduledFor,
      tracking: {
        opens: currentComposer.trackOpens,
        readReceipt: currentComposer.requestReadReceipt,
      },
      auditTrail: [
        { id: makeId("audit"), label: "Brouillon sauvegardé", timestamp: new Date().toISOString() },
        ...(scheduledFor
          ? [
              {
                id: makeId("audit"),
                label: `Envoi programmé le ${DATE_TIME_FORMATTER.format(new Date(scheduledFor))}`,
                timestamp: new Date().toISOString(),
              },
            ]
          : []),
      ],
    };
    const threadId = selectedThread?.id ?? makeId("thread");
    const isNewThread = !selectedThread;

    setThreads((current) => {
      if (isNewThread) {
        return [
          {
            id: threadId,
            accountId: selectedAccount.id,
            subject: composer.subject || "(Sans objet)",
            folder: "drafts",
            labels: [],
            preview: previewText.slice(0, 120),
            updatedAt: newMessage.createdAt,
            relatedEntity: linkedEntity,
            messages: [newMessage],
          },
          ...current,
        ];
      }
      return current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              folder: "drafts",
              preview: previewText.slice(0, 120),
              updatedAt: newMessage.createdAt,
              relatedEntity: linkedEntity,
              messages: [...thread.messages.filter((message) => message.status !== "BROUILLON"), newMessage],
            }
          : thread,
      );
    });
    addToast({
      variant: "success",
      title: "Brouillon enregistré",
    });
    setFolder("drafts");
    setSelectedThreadId(threadId);
    setShowAdvancedOptions(false);
  }

  const folderCounts = useMemo(() => {
    const counts: Record<MailFolder, number> = {
      inbox: 0,
      sent: 0,
      drafts: 0,
      archived: 0,
      spam: 0,
    };
    threads.forEach((thread) => {
      counts[thread.folder] += 1;
    });
    return counts;
  }, [threads]);

  const linkedEntityDescription = useMemo(() => {
    if (!linkedEntity) return "Aucun lien";
    if (linkedEntity.type === "client") {
      const client = clients.find((item) => item.id === linkedEntity.id);
      return client ? `Client — ${client.displayName}` : "Client";
    }
    if (linkedEntity.type === "invoice") {
      const invoice = invoices.find((item) => item.id === linkedEntity.id);
      return invoice ? `Facture ${invoice.number}` : "Facture";
    }
    if (linkedEntity.type === "quote") {
      const quote = quotes.find((item) => item.id === linkedEntity.id);
      return quote ? `Devis ${quote.number}` : "Devis";
    }
    return "Lien";
  }, [clients, invoices, linkedEntity, quotes]);

  const searchValue =
    activeTab === "mailbox"
      ? threadQuery
      : activeTab === "templates"
      ? templateQuery
      : activeTab === "accounts"
      ? accountQuery
      : auditQuery;

  const searchPlaceholder: Record<MessagerieTab, string> = {
    mailbox: "Rechercher une conversation...",
    templates: "Rechercher un modèle...",
    accounts: "Rechercher un compte...",
    activity: "Rechercher un événement...",
  };

  const canCompose = !!selectedAccount && permissions.send;
  const canReply = activeTab === "mailbox" && !!selectedThread;
  const canArchive = canReply;
  const canSpam = canReply;
  const currentTab = MESSAGERIE_TABS.find((tab) => tab.id === activeTab)!;
  const auditStatusCards: {
    status: MailStatus;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    description: string;
  }[] = [
    {
      status: "ENVOYE",
      label: "Envoyés",
      icon: Send,
      accent: "text-emerald-600 dark:text-emerald-300",
      description: "Messages transmis avec succès",
    },
    {
      status: "EN_ATTENTE",
      label: "En attente",
      icon: RefreshCw,
      accent: "text-amber-600 dark:text-amber-300",
      description: "Notifications en file d'envoi",
    },
    {
      status: "ECHEC",
      label: "Échecs",
      icon: ShieldCheck,
      accent: "text-red-600 dark:text-red-300",
      description: "Messages nécessitant une action",
    },
    {
      status: "BROUILLON",
      label: "Brouillons",
      icon: PenSquare,
      accent: "text-zinc-600 dark:text-zinc-300",
      description: "Préparés mais non envoyés",
    },
  ];

  function handleSearchChange(value: string) {
    if (activeTab === "mailbox") {
      setThreadQuery(value);
    } else if (activeTab === "templates") {
      setTemplateQuery(value);
    } else if (activeTab === "accounts") {
      setAccountQuery(value);
    } else {
      setAuditQuery(value);
    }
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Messagerie
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Gérez l&apos;envoi et la réception des e-mails liés à vos clients, devis et factures.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (!selectedAccount) return;
              addToast({
                variant: "info",
                title: "Synchronisation",
                description: `Connexion à ${selectedAccount.imap.host}:${selectedAccount.imap.port}`,
              });
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Synchroniser
          </Button>
          <Button
            onClick={() => {
              setActiveTab("mailbox");
              resetComposer();
            }}
            className="gap-2"
          >
            <PenSquare className="h-4 w-4" />
            Nouveau message
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="flex flex-wrap gap-2 border-b border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          {MESSAGERIE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                    : "bg-white text-zinc-600 shadow-sm hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="gap-2"
                onClick={() => {
                  setActiveTab("mailbox");
                  resetComposer();
                }}
                disabled={!canCompose}
              >
                <PenSquare className="h-4 w-4" />
                Composer
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (!selectedThread) return;
                  setActiveTab("mailbox");
                  prepareReply("reply");
                }}
                disabled={!canReply}
              >
                <Reply className="h-4 w-4" />
                Répondre
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setActiveTab("mailbox");
                  handleArchiveSelectedThread();
                }}
                disabled={!canArchive}
              >
                <Archive className="h-4 w-4" />
                Archiver
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setActiveTab("mailbox");
                  handleMarkAsSpam();
                }}
                disabled={!canSpam}
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentTab.description}</p>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                <input
                  className="h-9 w-full rounded-full border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-700 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  value={searchValue}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder={searchPlaceholder[activeTab]}
                />
              </div>
            </div>
          </div>

          {activeTab === "mailbox" ? (
            <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
              <aside className="space-y-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      Compte connecté
                    </h2>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {visibleAccounts.length} compte{visibleAccounts.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Sélectionnez le compte d&apos;envoi pour filtrer les conversations et appliquer la signature.
                  </p>
                  <select
                    className="input mt-3"
                    value={selectedAccount?.id ?? ""}
                    onChange={(event) => handleAccountChange(event.target.value)}
                    disabled={!canManageAccounts}
                  >
                    {visibleAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label} — {account.email}
                      </option>
                    ))}
                  </select>
                  {!canManageAccounts ? (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                      Lecture seule : la sélection d&apos;un autre compte est verrouillée pour votre profil.
                    </p>
                  ) : null}
                  {selectedAccount ? (
                    <dl className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="font-medium text-zinc-500 dark:text-zinc-400">IMAP</dt>
                        <dd>
                          {selectedAccount.imap.host}:{selectedAccount.imap.port}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="font-medium text-zinc-500 dark:text-zinc-400">SMTP</dt>
                        <dd>
                          {selectedAccount.smtp.host}:{selectedAccount.smtp.port}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Filtres rapides</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      onClick={() => {
                        setFolder("inbox");
                        setStatusFilter("all");
                        setLabelFilter(null);
                        setThreadQuery("");
                      }}
                    >
                      Réinitialiser
                    </Button>
                  </div>

                  <div className="mt-4 space-y-5">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dossiers</p>
                      <div className="mt-2 space-y-2">
                        {FOLDERS.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setFolder(item.id);
                                const firstThread = threads.find(
                                  (thread) =>
                                    thread.folder === item.id && thread.accountId === selectedAccount?.id,
                                );
                                setSelectedThreadId(firstThread?.id ?? null);
                              }}
                              className={clsx(
                                "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                                folder === item.id
                                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-200"
                                  : "border-zinc-200 hover:border-blue-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-blue-500 dark:hover:bg-zinc-900",
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {item.label}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {folderCounts[item.id]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Statut</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {STATUS_FILTERS.map((status) => (
                          <button
                            key={status.id}
                            type="button"
                            onClick={() => setStatusFilter(status.id)}
                            className={clsx(
                              "rounded-full px-3 py-1 text-xs font-medium transition",
                              statusFilter === status.id
                                ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
                            )}
                          >
                            {status.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Étiquettes</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {labels.map((label) => (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() =>
                              setLabelFilter((current) => (current === label.id ? null : label.id))
                            }
                            className={clsx(
                              "rounded-full px-3 py-1 text-xs font-medium transition",
                              label.color,
                              labelFilter === label.id
                                ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-zinc-950"
                                : "opacity-85 hover:opacity-100",
                            )}
                          >
                            {label.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
                          onClick={() => {
                            const name = prompt("Nom de la nouvelle étiquette");
                            if (name) addLabel(name);
                          }}
                        >
                          + Nouvelle
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Permissions</h2>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Activez les actions disponibles pour votre rôle.
                  </p>
                  <div className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions.view}
                        onChange={() =>
                          setPermissions((current) => ({ ...current, view: !current.view }))
                        }
                      />
                      Consulter les messages
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions.send}
                        onChange={() =>
                          setPermissions((current) => ({ ...current, send: !current.send }))
                        }
                      />
                      Envoyer des messages
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions.manageTemplates}
                        onChange={() =>
                          setPermissions((current) => ({
                            ...current,
                            manageTemplates: !current.manageTemplates,
                          }))
                        }
                      />
                      Gérer les modèles
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions.manageAccounts}
                        onChange={() =>
                          setPermissions((current) => ({
                            ...current,
                            manageAccounts: !current.manageAccounts,
                          }))
                        }
                      />
                      Gérer les comptes
                    </label>
                  </div>
                </div>
              </aside>

              <section className="space-y-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        type="search"
                        className="input pl-9"
                        placeholder="Rechercher une conversation..."
                        value={threadQuery}
                        onChange={(event) => setThreadQuery(event.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          resetComposer();
                          setShowAdvancedOptions(false);
                        }}
                        disabled={!canCompose}
                      >
                        <PenSquare className="h-3.5 w-3.5" /> Nouveau message
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleArchiveSelectedThread}
                        disabled={!canArchive}
                      >
                        <Archive className="h-3.5 w-3.5" /> Archiver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleMarkAsSpam}
                        disabled={!canSpam}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Spam
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {filteredThreads.length} conversation{filteredThreads.length > 1 ? "s" : ""} correspondent à votre recherche.
                  </p>
                </div>

                {!permissions.view ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    L&apos;accès à la boîte de réception est désactivé pour votre profil. Activez le droit « Consulter les messages » pour afficher les échanges.
                  </div>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        Conversations
                      </div>
                      <div className="max-h-[520px] divide-y divide-zinc-200 overflow-y-auto text-sm dark:divide-zinc-800">
                        {filteredThreads.length === 0 ? (
                          <p className="p-4 text-xs text-zinc-500 dark:text-zinc-400">
                            Aucun message dans ce dossier pour le moment.
                          </p>
                        ) : (
                          filteredThreads.map((thread) => {
                            const lastMessage = [...thread.messages].sort((a, b) =>
                              a.createdAt > b.createdAt ? -1 : 1,
                            )[0];
                            return (
                              <button
                                key={thread.id}
                                type="button"
                                onClick={() => {
                                  setSelectedThreadId(thread.id);
                                  setLinkedEntity(thread.relatedEntity);
                                }}
                                className={clsx(
                                  "flex w-full flex-col gap-1 px-3 py-2 text-left transition",
                                  selectedThreadId === thread.id
                                    ? "bg-blue-50 dark:bg-blue-500/20"
                                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                    {thread.subject}
                                  </span>
                                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {DATE_TIME_FORMATTER.format(new Date(thread.updatedAt))}
                                  </span>
                                </div>
                                <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                                  {thread.preview}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {thread.labels.map((labelId) => {
                                    const label = labels.find((item) => item.id === labelId);
                                    if (!label) return null;
                                    return (
                                      <span
                                        key={label.id}
                                        className={clsx("rounded-full px-2 py-0.5 text-[10px]", label.color)}
                                      >
                                        {label.name}
                                      </span>
                                    );
                                  })}
                                  {lastMessage ? (
                                    <span
                                      className={clsx(
                                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                        lastMessage.status === "ENVOYE"
                                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                                          : lastMessage.status === "ECHEC"
                                          ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
                                          : lastMessage.status === "EN_ATTENTE"
                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
                                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
                                      )}
                                    >
                                      {lastMessage.status === "ENVOYE"
                                        ? "Envoyé"
                                        : lastMessage.status === "ECHEC"
                                        ? "Échec"
                                        : lastMessage.status === "EN_ATTENTE"
                                        ? "En attente"
                                        : "Brouillon"}
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {selectedThread ? (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                          <div className="flex flex-col gap-3 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                  {selectedThread.subject}
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {linkedEntityDescription}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {selectedThread.labels.map((labelId) => {
                                    const label = labels.find((item) => item.id === labelId);
                                    if (!label) return null;
                                    return (
                                      <span
                                        key={label.id}
                                        className={clsx("rounded-full px-2 py-0.5 text-[10px]", label.color)}
                                      >
                                        {label.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 text-xs"
                                  onClick={() => prepareReply("reply")}
                                >
                                  <Reply className="h-3.5 w-3.5" /> Répondre
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 text-xs"
                                  onClick={() => prepareReply("forward")}
                                >
                                  <Forward className="h-3.5 w-3.5" /> Transférer
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Liens dynamiques
                              </span>
                              <select
                                className="input h-8 text-xs"
                                value={linkedEntity ? `${linkedEntity.type}:${linkedEntity.id}` : ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (!value) {
                                    linkThreadToEntity(selectedThread.id, null);
                                    return;
                                  }
                                  const [type, id] = value.split(":");
                                  if (type === "client" || type === "invoice" || type === "quote") {
                                    linkThreadToEntity(selectedThread.id, { type, id });
                                  }
                                }}
                              >
                                <option value="">Aucun lien</option>
                                <optgroup label="Clients">
                                  {clients.map((client) => (
                                    <option key={client.id} value={`client:${client.id}`}>
                                      {client.displayName}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Factures">
                                  {invoices.map((invoice) => (
                                    <option key={invoice.id} value={`invoice:${invoice.id}`}>
                                      {invoice.number} — {invoice.clientName}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Devis">
                                  {quotes.map((quote) => (
                                    <option key={quote.id} value={`quote:${quote.id}`}>
                                      {quote.number} — {quote.clientName}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              <div className="flex flex-wrap gap-1">
                                {labels.map((label) => (
                                  <button
                                    key={label.id}
                                    type="button"
                                    className={clsx(
                                      "rounded-full px-2 py-0.5 text-[10px]",
                                      label.color,
                                      selectedThread.labels.includes(label.id)
                                        ? "ring-1 ring-offset-1 ring-blue-500 dark:ring-offset-zinc-950"
                                        : "opacity-80 hover:opacity-100",
                                    )}
                                    onClick={() => toggleLabelOnThread(selectedThread.id, label.id)}
                                  >
                                    {label.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4 pt-3 text-sm">
                            {selectedThread.messages
                              .slice()
                              .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
                              .map((message) => {
                                const isHtml = /<\/?[a-z][\s\S]*>/i.test(message.body);
                                return (
                                  <article
                                    key={message.id}
                                    className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                                  >
                                    <header className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                      <div className="flex items-center gap-1">
                                        {message.direction === "incoming" ? (
                                          <ArrowDownLeft className="h-3.5 w-3.5" />
                                        ) : (
                                          <ArrowUpRight className="h-3.5 w-3.5" />
                                        )}
                                        <span>
                                          {message.direction === "incoming" ? message.from : selectedAccount?.email}
                                        </span>
                                        <ArrowRight className="h-3 w-3" />
                                        <span>{message.to.join(", ")}</span>
                                      </div>
                                      <time>{DATE_TIME_FORMATTER.format(new Date(message.createdAt))}</time>
                                    </header>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                      {message.priority === "high" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-200">
                                          <AlertTriangle className="h-3 w-3" /> Priorité haute
                                        </span>
                                      ) : null}
                                      {message.scheduledFor ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                                          <CalendarClock className="h-3 w-3" /> Planifié le {DATE_TIME_FORMATTER.format(new Date(message.scheduledFor))}
                                        </span>
                                      ) : null}
                                      {message.tracking.opens ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                                          <Eye className="h-3 w-3" /> Suivi ouvertures
                                        </span>
                                      ) : null}
                                      {message.tracking.readReceipt ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                                          <CheckCheck className="h-3 w-3" /> Accusé demandé
                                        </span>
                                      ) : null}
                                    </div>
                                    {isHtml ? (
                                      <div
                                        className="mt-3 text-sm text-zinc-700 dark:text-zinc-200 [&_p]:my-2 [&_p]:leading-relaxed [&_table]:w-full [&_td]:px-2 [&_td]:py-1"
                                        dangerouslySetInnerHTML={{ __html: message.body }}
                                      />
                                    ) : (
                                      <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
                                        {message.body}
                                      </div>
                                    )}
                                    {message.attachments.length > 0 ? (
                                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                        <Paperclip className="h-3.5 w-3.5" />
                                        {message.attachments.map((attachment) => (
                                          <span
                                            key={attachment.id}
                                            className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700"
                                          >
                                            {attachment.name}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                    <div className="mt-3 space-y-1">
                                      {message.auditTrail.map((trace) => (
                                        <div
                                          key={trace.id}
                                          className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400"
                                        >
                                          <CalendarClock className="h-3 w-3" />
                                          <span>{trace.label}</span>
                                          <span className="text-zinc-400">
                                            {DATE_TIME_FORMATTER.format(new Date(trace.timestamp))}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </article>
                                );
                              })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                          Sélectionnez une conversation pour afficher son contenu.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <aside className="space-y-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <MessageSquare className="h-4 w-4" /> Rédaction
                  </h3>
                  {!permissions.send ? (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                      Vous n&apos;avez pas l&apos;autorisation d&apos;envoyer des messages. Activez le droit correspondant pour utiliser le compositeur.
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-3 text-sm">
                    <label className="block">
                      <span className="label">À</span>
                      <input
                        className="input"
                        value={composer.to}
                        onChange={(event) =>
                          setComposer((current) => ({ ...current, to: event.target.value }))
                        }
                        placeholder="destinataire@example.com"
                        disabled={!permissions.send}
                      />
                    </label>
                    <label className="block">
                      <span className="label">Cc</span>
                      <input
                        className="input"
                        value={composer.cc}
                        onChange={(event) =>
                          setComposer((current) => ({ ...current, cc: event.target.value }))
                        }
                        disabled={!permissions.send}
                      />
                    </label>
                    <label className="block">
                      <span className="label">Cci</span>
                      <input
                        className="input"
                        value={composer.bcc}
                        onChange={(event) =>
                          setComposer((current) => ({ ...current, bcc: event.target.value }))
                        }
                        disabled={!permissions.send}
                      />
                    </label>
                    <label className="block">
                      <span className="label">Sujet</span>
                      <input
                        className="input"
                        value={composer.subject}
                        onChange={(event) =>
                          setComposer((current) => ({ ...current, subject: event.target.value }))
                        }
                        disabled={!permissions.send}
                      />
                    </label>
                    <label className="block">
                      <span className="label">Message</span>
                      <textarea
                        ref={bodyRef}
                        className="input min-h-[180px]"
                        value={composer.body}
                        onChange={(event) =>
                          setComposer((current) => ({ ...current, body: event.target.value }))
                        }
                        placeholder="Rédigez votre message en toute clarté. Utilisez les variables dynamiques pour personnaliser le contenu."
                        disabled={!permissions.send}
                      />
                    </label>

                    <div
                      className="rounded-xl border border-dashed border-zinc-300 p-4 text-xs text-zinc-500 transition hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={handleAttachmentDrop}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Glissez-déposez des fichiers ici ou
                        <button
                          type="button"
                          className="font-medium text-blue-600 underline decoration-dotted underline-offset-2 hover:text-blue-700 dark:text-blue-400"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!permissions.send}
                        >
                          parcourez vos documents
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => handleAddAttachment(event.target.files)}
                        disabled={!permissions.send}
                      />
                    </div>

                    {composer.attachments.length > 0 ? (
                      <div className="space-y-2">
                        {composer.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-700"
                          >
                            <div>
                              <p className="font-medium text-zinc-700 dark:text-zinc-200">{attachment.name}</p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {formatBytes(attachment.size)} · {attachment.inline ? "Intégré" : "Pièce jointe"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                onClick={() => toggleAttachmentInline(attachment.id)}
                              >
                                {attachment.inline ? "Envoyer en PJ" : "Afficher dans le corps"}
                              </button>
                              <button
                                type="button"
                                className="text-xs text-red-500 hover:underline"
                                onClick={() => removeAttachment(attachment.id)}
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {composer.error ? (
                      <p className="text-xs text-red-500">{composer.error}</p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        className="gap-2"
                        onClick={() => handleSendMessage()}
                        disabled={!permissions.send || composer.sending}
                      >
                        <Send className="h-4 w-4" /> Envoyer
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => handleSaveDraft()}
                        disabled={!permissions.send || composer.sending}
                      >
                        <Tag className="h-4 w-4" /> Enregistrer le brouillon
                      </Button>
                      <Button
                        variant="ghost"
                        className="gap-2"
                        onClick={() => resetComposer()}
                        disabled={composer.sending}
                      >
                        <Trash2 className="h-4 w-4" /> Effacer
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-zinc-800 transition hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
                    onClick={() => setShowAdvancedOptions((value) => !value)}
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="h-4 w-4" /> Options avancées
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {showAdvancedOptions ? "Masquer" : "Afficher"}
                    </span>
                  </button>
                  {showAdvancedOptions ? (
                    <div className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={composer.includeSignature}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setComposer((current) => {
                              const signature = selectedAccount?.signature ?? "";
                              return {
                                ...current,
                                includeSignature: checked && Boolean(signature),
                                body: checked
                                  ? ensureSignature(current.body, signature)
                                  : stripSignature(current.body, signature),
                              };
                            });
                          }}
                          disabled={!selectedAccount?.signature}
                        />
                        <span>
                          Inclure la signature automatique
                          {!selectedAccount?.signature ? " (aucune signature configurée)" : ""}
                        </span>
                      </label>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={composer.trackOpens}
                          onChange={() =>
                            setComposer((current) => ({
                              ...current,
                              trackOpens: !current.trackOpens,
                            }))
                          }
                        />
                        Activer le suivi des ouvertures
                      </label>
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={composer.requestReadReceipt}
                          onChange={() =>
                            setComposer((current) => ({
                              ...current,
                              requestReadReceipt: !current.requestReadReceipt,
                            }))
                          }
                        />
                        Demander un accusé de lecture
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={composer.scheduleSend}
                            onChange={(event) =>
                              setComposer((current) => ({
                                ...current,
                                scheduleSend: event.target.checked,
                                scheduleAt: event.target.checked ? current.scheduleAt : "",
                              }))
                            }
                          />
                          Planifier l&apos;envoi
                        </label>
                        {composer.scheduleSend ? (
                          <input
                            type="datetime-local"
                            className="input text-xs"
                            value={composer.scheduleAt}
                            onChange={(event) =>
                              setComposer((current) => ({
                                ...current,
                                scheduleAt: event.target.value,
                              }))
                            }
                            min={new Date().toISOString().slice(0, 16)}
                          />
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Priorité</span>
                        <select
                          className="input text-xs"
                          value={composer.priority}
                          onChange={(event) =>
                            setComposer((current) => ({
                              ...current,
                              priority: event.target.value as MailComposerState["priority"],
                            }))
                          }
                        >
                          <option value="normal">Normale</option>
                          <option value="high">Haute</option>
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    <FileText className="h-4 w-4" /> Modèle HTML professionnel
                  </h3>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Prévisualisez le modèle d&apos;e-mail responsive et insérez-le en un clic.
                    </p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div className="max-h-64 overflow-y-auto bg-zinc-50 p-3 dark:bg-zinc-900">
                      <div
                        className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-200 [&_table]:w-full [&_td]:align-top"
                        dangerouslySetInnerHTML={{ __html: professionalTemplate }}
                      />
                    </div>
                    <textarea
                      className="input h-32 w-full rounded-none border-t border-zinc-200 font-mono text-[11px] leading-snug dark:border-zinc-800"
                      readOnly
                      value={professionalTemplate}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" className="gap-2" onClick={handleApplyProfessionalTemplate}>
                      <Sparkles className="h-3.5 w-3.5" /> Utiliser ce modèle
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                        onClick={async () => {
                          try {
                            if (typeof navigator === "undefined" || !navigator.clipboard) {
                              throw new Error("clipboard API indisponible");
                            }
                            await navigator.clipboard.writeText(professionalTemplate);
                            addToast({
                              variant: "success",
                              title: "Modèle copié",
                              description: "Le code HTML est disponible dans votre presse-papiers.",
                            });
                          } catch (error) {
                            console.error(error);
                            addToast({
                              variant: "error",
                              title: "Copie impossible",
                              description: "Votre navigateur n'autorise pas la copie automatique.",
                            });
                          }
                        }}
                    >
                      Copier le HTML
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <Sparkles className="h-4 w-4" /> Outils rapides
                  </h3>
                  <div className="mt-3 space-y-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Variables dynamiques</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {availableVariables.map((variable) => (
                          <button
                            key={variable.key}
                            type="button"
                            onClick={() => handleInsertVariable(variable.key)}
                            className="flex flex-col items-start rounded-xl border border-zinc-200 bg-white p-3 text-left text-xs transition hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-400 dark:hover:bg-blue-500/10"
                          >
                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                              {"{{"}
                              {variable.key}
                              {"}}"}
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400">{variable.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Réponses rapides</p>
                      {!canManageTemplates ? (
                        <p className="mb-2 text-xs text-amber-600 dark:text-amber-300">
                          Lecture seule : l&apos;insertion est désactivée pour votre rôle.
                        </p>
                      ) : null}
                      {quickTemplates.length === 0 ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Aucun modèle disponible pour ce compte.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {quickTemplates.map((template) => (
                            <div
                              key={template.id}
                              className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium text-zinc-800 dark:text-zinc-200">{template.name}</p>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Sujet : {template.subject}</p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="text-xs"
                                  onClick={() => handleInsertTemplate(template)}
                                  disabled={!canManageTemplates}
                                >
                                  Insérer
                                </Button>
                              </div>
                              <p className="whitespace-pre-wrap text-xs text-zinc-500 dark:text-zinc-300">
                                {template.body}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          ) : null}
          {activeTab === "templates" ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                {TEMPLATE_CATEGORY_FILTERS.map((category) => {
                  const meta = category === "all" ? null : TEMPLATE_CATEGORY_METADATA[category];
                  const Icon = category === "all" ? Filter : meta.icon;
                  const label = category === "all" ? "Toutes les catégories" : meta.label;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setTemplateCategory(category)}
                      className={clsx(
                        "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition",
                        templateCategory === category
                          ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {TEMPLATE_CATEGORIES.map((category) => {
                  const templates = templatesByCategory[category];
                  const meta = TEMPLATE_CATEGORY_METADATA[category];
                  const Icon = meta.icon;
                  return (
                    <section
                      key={category}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <header className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                            <Icon className="h-4 w-4" />
                            {meta.label}
                          </div>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {meta.description}
                          </p>
                        </div>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {templates.length} {templates.length > 1 ? "modèles" : "modèle"}
                        </span>
                      </header>
                      <div className="mt-4 space-y-4">
                        {templates.length === 0 ? (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Aucun modèle ne correspond à cette recherche.
                          </p>
                        ) : (
                          templates.map((template) => (
                            <article
                              key={template.id}
                              className="space-y-3 rounded-xl border border-zinc-200 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                                    {template.name}
                                  </h3>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Sujet : {template.subject}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {template.quickReply ? (
                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                                      Réponse rapide
                                    </span>
                                  ) : null}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="text-xs"
                                    onClick={() => handleInsertTemplate(template)}
                                    disabled={!canManageTemplates}
                                  >
                                    Insérer
                                  </Button>
                                </div>
                              </div>
                              <div className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
                                {template.body}
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : null}

          {activeTab === "accounts" ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Comptes</h2>
                <div className="mt-4 space-y-2">
                  {visibleAccounts.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Aucun compte ne correspond à votre recherche.
                    </p>
                  ) : (
                    visibleAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleAccountChange(account.id)}
                        className={clsx(
                          "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                          account.id === selectedAccount?.id
                            ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-200"
                            : "border-zinc-200 hover:border-blue-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-blue-500 dark:hover:bg-zinc-900",
                        )}
                      >
                        <p className="font-medium">{account.label}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{account.email}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Configuration</h2>
                {selectedAccount ? (
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        IMAP (réception)
                      </p>
                      <label className="block">
                        <span className="label">Serveur</span>
                        <input
                          className="input"
                          value={selectedAccount.imap.host}
                          onChange={(event) =>
                            updateNestedAccountField(selectedAccount.id, "imap", "host", event.target.value)
                          }
                          disabled={!canManageAccounts}
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="label">Port</span>
                          <input
                            className="input"
                            type="number"
                            value={selectedAccount.imap.port}
                            onChange={(event) =>
                              updateNestedAccountField(
                                selectedAccount.id,
                                "imap",
                                "port",
                                Number(event.target.value),
                              )
                            }
                            disabled={!canManageAccounts}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            checked={selectedAccount.imap.secure}
                            onChange={() =>
                              updateNestedAccountField(
                                selectedAccount.id,
                                "imap",
                                "secure",
                                !selectedAccount.imap.secure,
                              )
                            }
                            disabled={!canManageAccounts}
                          />
                          SSL / TLS
                        </label>
                      </div>
                      <label className="block">
                        <span className="label">Identifiant</span>
                        <input
                          className="input"
                          value={selectedAccount.imap.username}
                          onChange={(event) =>
                            updateNestedAccountField(selectedAccount.id, "imap", "username", event.target.value)
                          }
                          disabled={!canManageAccounts}
                        />
                      </label>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        SMTP (envoi)
                      </p>
                      <label className="block">
                        <span className="label">Serveur</span>
                        <input
                          className="input"
                          value={selectedAccount.smtp.host}
                          onChange={(event) =>
                            updateNestedAccountField(selectedAccount.id, "smtp", "host", event.target.value)
                          }
                          disabled={!canManageAccounts}
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="label">Port</span>
                          <input
                            className="input"
                            type="number"
                            value={selectedAccount.smtp.port}
                            onChange={(event) =>
                              updateNestedAccountField(
                                selectedAccount.id,
                                "smtp",
                                "port",
                                Number(event.target.value),
                              )
                            }
                            disabled={!canManageAccounts}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            checked={selectedAccount.smtp.secure}
                            onChange={() =>
                              updateNestedAccountField(
                                selectedAccount.id,
                                "smtp",
                                "secure",
                                !selectedAccount.smtp.secure,
                              )
                            }
                            disabled={!canManageAccounts}
                          />
                          SSL / STARTTLS
                        </label>
                      </div>
                      <label className="block">
                        <span className="label">Identifiant</span>
                        <input
                          className="input"
                          value={selectedAccount.smtp.username}
                          onChange={(event) =>
                            updateNestedAccountField(selectedAccount.id, "smtp", "username", event.target.value)
                          }
                          disabled={!canManageAccounts}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="label">Signature personnalisée</span>
                      <textarea
                        className="input min-h-[100px]"
                        value={selectedAccount.signature}
                        onChange={(event) =>
                          updateAccountField(selectedAccount.id, "signature", event.target.value)
                        }
                        disabled={!canManageAccounts}
                      />
                    </label>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Automatisations
                      </p>
                      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selectedAccount.automations.followUps}
                          onChange={() => toggleAutomation(selectedAccount.id, "followUps")}
                          disabled={!canManageAccounts}
                        />
                        Relance automatique des retards
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selectedAccount.automations.autoArchive}
                          onChange={() => toggleAutomation(selectedAccount.id, "autoArchive")}
                          disabled={!canManageAccounts}
                        />
                        Archivage après réponse
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selectedAccount.automations.linkDocuments}
                          onChange={() => toggleAutomation(selectedAccount.id, "linkDocuments")}
                          disabled={!canManageAccounts}
                        />
                        Lien automatique avec factures / devis
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                    Sélectionnez un compte pour afficher ses paramètres.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "activity" ? (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {auditStatusCards.map((card) => {
                  const Icon = card.icon;
                  const count = auditStatusSummary[card.status] ?? 0;
                  return (
                    <div
                      key={card.status}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={clsx("h-5 w-5", card.accent)} />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{card.label}</span>
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {count}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Journal d&apos;activité
                </h2>
                <div className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
                  {filteredAuditLogs.length === 0 ? (
                    <p>Aucun événement enregistré.</p>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-700 dark:text-zinc-200">
                            {log.subject}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {DATE_TIME_FORMATTER.format(new Date(log.createdAt))}
                          </span>
                        </div>
                        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                          Vers {log.to} — {log.status === "ENVOYE" ? "Envoyé" : log.status === "ECHEC" ? "Échec" : log.status === "EN_ATTENTE" ? "En attente" : "Brouillon"}
                        </p>
                        {log.error ? (
                          <p className="mt-1 text-red-500">Erreur : {log.error}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
