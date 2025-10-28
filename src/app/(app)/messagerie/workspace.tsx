"use client";

import { useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  Archive,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
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
  bodyHtml?: string | null;
  format: "text" | "html";
  requestReadReceipt?: boolean;
  trackLinks?: boolean;
  scheduledFor?: string | null;
  createdAt: string;
  attachments: MailAttachment[];
  status: MailStatus;
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
  format: "text" | "html";
  category: TemplateCategory;
  quickReply: boolean;
};

type MailComposerState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  bodyHtml: string;
  format: "text" | "html";
  attachments: MailAttachment[];
  requestReadReceipt: boolean;
  trackLinks: boolean;
  scheduleSend: boolean;
  scheduledFor: string | null;
  sending: boolean;
  error: string | null;
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

const PROFESSIONAL_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Communication client</title>
    <style>
      body {
        margin: 0;
        font-family: 'Segoe UI', Roboto, Arial, sans-serif;
        background-color: #f4f4f8;
        color: #1f2937;
      }
      .wrapper {
        width: 100%;
        background-color: #f4f4f8;
        padding: 32px 0;
      }
      .container {
        max-width: 640px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(15, 23, 42, 0.12);
      }
      .header {
        background: linear-gradient(135deg, #1d4ed8, #6366f1);
        color: #ffffff;
        padding: 32px 40px;
        text-align: left;
      }
      .header h1 {
        margin: 0 0 8px 0;
        font-size: 28px;
        font-weight: 600;
      }
      .content {
        padding: 32px 40px;
      }
      .cta {
        display: inline-block;
        padding: 12px 24px;
        margin: 24px 0;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        color: #ffffff;
        text-decoration: none;
        border-radius: 999px;
        font-weight: 600;
      }
      .info-box {
        margin-top: 24px;
        border-radius: 12px;
        background-color: #f8fafc;
        padding: 16px 20px;
        border: 1px solid #e2e8f0;
      }
      .footer {
        padding: 24px 40px;
        background-color: #0f172a;
        color: #e2e8f0;
        font-size: 13px;
      }
      .footer a {
        color: #93c5fd;
        text-decoration: none;
      }
      @media (max-width: 600px) {
        .container {
          border-radius: 0;
        }
        .header,
        .content,
        .footer {
          padding: 24px;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <table class="container" role="presentation" cellspacing="0" cellpadding="0">
        <tr>
          <td class="header">
            <h1>Bonjour {{client.nom}},</h1>
            <p>Un nouveau suivi concernant {{objet}}.</p>
          </td>
        </tr>
        <tr>
          <td class="content">
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
              Nous espérons que vous allez bien. Nous revenons vers vous au sujet de {{objet}}.
            </p>
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">
              <strong>Résumé :</strong><br />
              • Document : {{facture.numero}}<br />
              • Montant : {{facture.total}}<br />
              • Date d'émission : {{facture.date}}
            </p>
            <a class="cta" href="{{lien.paiement}}" target="_blank" rel="noopener">
              Accéder au portail client
            </a>
            <div class="info-box">
              <p style="margin: 0 0 8px 0; font-weight: 600;">Pourquoi ce message ?</p>
              <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                Ce courriel est généré automatiquement afin de vous informer de la progression de vos documents.
                Vous pouvez répondre directement pour contacter votre chargé de compte ou planifier un rendez-vous.
              </p>
            </div>
            <p style="margin: 24px 0 0 0; font-size: 16px; line-height: 1.6;">{{signature}}</p>
          </td>
        </tr>
        <tr>
          <td class="footer">
            <p style="margin: 0 0 8px 0;">{{societe.nom}}</p>
            <p style="margin: 0 0 8px 0;">{{societe.adresse}}</p>
            <p style="margin: 0;">
              <a href="mailto:{{societe.email}}">{{societe.email}}</a> · {{societe.telephone}}
            </p>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]{2,}/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />") || "&nbsp;"}</p>`)
    .join("");
}

function extractBodyHtml(html: string) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function toDatetimeLocalInput(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function composerPreview(composer: MailComposerState) {
  const source = composer.format === "html" ? composer.bodyHtml : composer.body;
  const text = composer.format === "html" ? stripHtml(source) : source;
  return text.slice(0, 160);
}

function formatDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return DATE_TIME_FORMATTER.format(date);
}

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
      format: "text",
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
      format: "text",
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
      format: "text",
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
      format: "text",
      category: "reponse",
      quickReply: true,
    },
    {
      id: "template-html-pro",
      accountId: null,
      name: "Email professionnel (HTML)",
      subject: "Suivi de votre dossier {{facture.numero}}",
      body: PROFESSIONAL_EMAIL_TEMPLATE,
      format: "html",
      category: "nouveau",
      quickReply: false,
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
          bodyHtml: null,
          format: "text",
          createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          attachments: [],
          status: "ENVOYE",
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
          bodyHtml: null,
          format: "text",
          createdAt: new Date(now.getTime() - 65 * 60 * 1000).toISOString(),
          attachments: [],
          status: "ENVOYE",
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
          bodyHtml: null,
          format: "text",
          createdAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
          attachments: [],
          status: "BROUILLON",
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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
  const [composer, setComposer] = useState<MailComposerState>({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: initialAccounts[0] ? `\n\n${initialAccounts[0].signature}` : "",
    bodyHtml: "",
    format: "text",
    attachments: [],
    requestReadReceipt: false,
    trackLinks: false,
    scheduleSend: false,
    scheduledFor: null,
    sending: false,
    error: null,
  });

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
      "lien.paiement": "https://example.com/portail-client",
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

  const professionalTemplate = useMemo(
    () => templates.find((template) => template.id === "template-html-pro") ?? null,
    [templates],
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

  const totalAttachmentSize = useMemo(
    () => composer.attachments.reduce((sum, attachment) => sum + attachment.size, 0),
    [composer.attachments],
  );

  function handleAccountChange(accountId: string) {
    setSelectedAccountId(accountId);
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
    const renderedSubject = renderTemplate(
      template.subject,
      relatedContext,
      selectedAccount.signature,
    );

    if (template.format === "html") {
      const renderedHtml = renderTemplate(
        template.body,
        relatedContext,
        selectedAccount.signature,
      );
      const renderedText = stripHtml(renderedHtml);
      setComposer((current) => {
        const nextHtml =
          current.format === "html" && current.bodyHtml
            ? `${current.bodyHtml}\n${renderedHtml}`
            : renderedHtml;
        const nextBody =
          current.format === "html"
            ? stripHtml(nextHtml)
            : current.body
            ? `${current.body}\n\n${renderedText}`
            : renderedText;
        return {
          ...current,
          subject: current.subject || renderedSubject,
          format: "html",
          bodyHtml: nextHtml,
          body: nextBody,
        };
      });
    } else {
      const renderedText = renderTemplate(
        template.body,
        relatedContext,
        selectedAccount.signature,
      );
      setComposer((current) => {
        const updatedBody = current.body
          ? `${current.body}\n\n${renderedText}`
          : renderedText;
        const updatedHtml = current.format === "html"
          ? `${current.bodyHtml || textToHtml(current.body)}${textToHtml(renderedText)}`
          : current.bodyHtml;
        return {
          ...current,
          subject: current.subject || renderedSubject,
          body: updatedBody,
          bodyHtml: current.format === "html" ? updatedHtml : current.bodyHtml,
          format: current.format === "html" ? "html" : "text",
        };
      });
    }
    addToast({
      variant: "success",
      title: "Modèle inséré",
      description:
        template.format === "html"
          ? `Le modèle HTML "${template.name}" est prêt à être personnalisé.`
          : `Le modèle "${template.name}" a été ajouté à votre message.`,
    });
  }

  function handleInsertVariable(variable: string) {
    setComposer((current) => {
      if (current.format === "html") {
        addToast({
          variant: "info",
          title: "Insertion de variable",
          description:
            "Passez en mode texte pour insérer des variables personnalisées dans le contenu HTML.",
        });
        return current;
      }
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
    if (!fileList) return;
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
    setComposer({
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: selectedAccount ? `\n\n${selectedAccount.signature}` : "",
      bodyHtml: "",
      format: "text",
      attachments: [],
      requestReadReceipt: false,
      trackLinks: false,
      scheduleSend: false,
      scheduledFor: null,
      sending: false,
      error: null,
    });
  }

  function prepareReply(direction: "reply" | "forward") {
    if (!selectedThread) return;
    const lastMessage = [...selectedThread.messages].sort((a, b) =>
      a.createdAt > b.createdAt ? -1 : 1,
    )[0];
    if (!lastMessage) return;
    const quotedText =
      direction === "reply"
        ? `\n\n----- Message d'origine -----\n${lastMessage.body}`
        : `\n\n----- Transfert -----\n${lastMessage.body}`;
    const quotedHtmlContent = lastMessage.format === "html" && lastMessage.bodyHtml
      ? extractBodyHtml(lastMessage.bodyHtml)
      : textToHtml(lastMessage.body);
    const wrapperHtml =
      `<div style="margin-top:16px;padding-left:16px;border-left:2px solid #e2e8f0;color:#334155;">${quotedHtmlContent}</div>`;
    setComposer({
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
      body: quotedText,
      bodyHtml:
        lastMessage.format === "html"
          ? `<p></p>${wrapperHtml}`
          : textToHtml(quotedText),
      format: lastMessage.format,
      attachments: direction === "forward" ? lastMessage.attachments : [],
      requestReadReceipt: composer.requestReadReceipt,
      trackLinks: composer.trackLinks,
      scheduleSend: composer.scheduleSend,
      scheduledFor: composer.scheduledFor,
      sending: false,
      error: null,
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

    const scheduledDate = composer.scheduledFor ? new Date(composer.scheduledFor) : null;
    const hasValidSchedule = scheduledDate && !Number.isNaN(scheduledDate.getTime());
    if (composer.scheduleSend && !hasValidSchedule) {
      addToast({
        variant: "error",
        title: "Programmation invalide",
        description: "Sélectionnez une date et une heure valides pour programmer l'envoi.",
      });
      setComposer((current) => ({
        ...current,
        error: "Sélectionnez une date et une heure valides pour la programmation.",
      }));
      return;
    }

    setComposer((current) => ({ ...current, sending: true, error: null }));
    const htmlSource = composer.format === "html" ? composer.bodyHtml || composer.body : composer.body;
    const renderedBody = renderTemplate(htmlSource, relatedContext, selectedAccount.signature);
    const textBody = composer.format === "html"
      ? stripHtml(renderedBody)
      : renderedBody;
    const shouldSchedule = Boolean(composer.scheduleSend && hasValidSchedule);
    const scheduledTimestamp = shouldSchedule && scheduledDate ? scheduledDate.toISOString() : null;
    const nowIso = new Date().toISOString();
    const baseAudit: MailAuditTrace[] = [
      {
        id: makeId("audit"),
        label: shouldSchedule
          ? `Programmation confirmée pour ${formatDateTimeInput(composer.scheduledFor)}`
          : "Message en file d'attente",
        timestamp: nowIso,
      },
      shouldSchedule
        ? {
            id: makeId("audit"),
            label: "Planification envoyée au serveur",
            timestamp: nowIso,
          }
        : {
            id: makeId("audit"),
            label: "Transmis au serveur SMTP",
            timestamp: nowIso,
          },
    ];
    if (composer.requestReadReceipt) {
      baseAudit.push({
        id: makeId("audit"),
        label: "Accusé de réception demandé",
        timestamp: nowIso,
      });
    }
    if (composer.trackLinks) {
      baseAudit.push({
        id: makeId("audit"),
        label: "Suivi des clics activé",
        timestamp: nowIso,
      });
    }
    const newMessage: MailMessage = {
      id: makeId("msg"),
      direction: "outgoing",
      from: selectedAccount.email,
      to: composer.to.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      cc: composer.cc.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      bcc: composer.bcc.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      subject: composer.subject,
      body: textBody,
      bodyHtml: composer.format === "html" ? renderedBody : null,
      format: composer.format,
      requestReadReceipt: composer.requestReadReceipt || undefined,
      trackLinks: composer.trackLinks || undefined,
      scheduledFor: scheduledTimestamp,
      createdAt: nowIso,
      attachments: composer.attachments,
      status: shouldSchedule ? "EN_ATTENTE" : "ENVOYE",
      auditTrail: baseAudit,
    };

    const threadId = selectedThread?.id ?? makeId("thread");
    const isNewThread = !selectedThread;

    setThreads((current) => {
      if (isNewThread) {
        return [
          {
            id: threadId,
            accountId: selectedAccount.id,
            subject: composer.subject,
            folder: "sent",
            labels: linkedEntity ? ["suivi"] : [],
            preview: composerPreview(composer),
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
              preview: composerPreview(composer),
              updatedAt: newMessage.createdAt,
              messages: [...thread.messages, newMessage],
            }
          : thread,
      );
    });

    addToast({
      variant: "success",
      title: shouldSchedule ? "Envoi planifié" : "E-mail envoyé",
      description: shouldSchedule
        ? `Le message sera expédié le ${formatDateTimeInput(composer.scheduledFor)} depuis ${selectedAccount.smtp.host}.`
        : `Votre message a été transmis via ${selectedAccount.smtp.host}:${selectedAccount.smtp.port}.`,
    });

    resetComposer();
    setSelectedThreadId(threadId);
    setFolder("sent");
  }
  function handleSaveDraft() {
    if (!selectedAccount) return;
    const newMessage: MailMessage = {
      id: makeId("draft"),
      direction: "outgoing",
      from: selectedAccount.email,
      to: composer.to.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      cc: composer.cc.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      bcc: composer.bcc.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      subject: composer.subject || "(Sans objet)",
      body: composer.format === "html" ? stripHtml(composer.bodyHtml || composer.body) : composer.body,
      bodyHtml: composer.format === "html" ? composer.bodyHtml || composer.body : null,
      format: composer.format,
      requestReadReceipt: composer.requestReadReceipt || undefined,
      trackLinks: composer.trackLinks || undefined,
      scheduledFor: composer.scheduleSend ? composer.scheduledFor : undefined,
      createdAt: new Date().toISOString(),
      attachments: composer.attachments,
      status: "BROUILLON",
      auditTrail: [
        { id: makeId("audit"), label: "Brouillon sauvegardé", timestamp: new Date().toISOString() },
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
            preview: composerPreview(composer),
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
              preview: composerPreview(composer),
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

  const canCompose = !!selectedAccount;
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
              <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                <Inbox className="h-3.5 w-3.5" />
                <select
                  className="bg-transparent text-xs outline-none"
                  value={selectedAccount?.id ?? ""}
                  onChange={(event) => handleAccountChange(event.target.value)}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </div>
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
            <div className="flex flex-col gap-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
                <div className="flex flex-col gap-6">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Navigation simplifiée</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Sélectionnez un compte puis un dossier pour consulter vos conversations.
                        </p>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {accounts.length} {accounts.length > 1 ? "comptes" : "compte"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <label className="flex flex-col gap-2">
                        <span className="font-medium text-zinc-700 dark:text-zinc-200">Compte actif</span>
                        <select
                          className="input"
                          value={selectedAccount?.id ?? ""}
                          onChange={(event) => handleAccountChange(event.target.value)}
                        >
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.label} — {account.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selectedAccount ? (
                        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                          <p>
                            IMAP : {selectedAccount.imap.host}:{selectedAccount.imap.port} · SMTP : {selectedAccount.smtp.host}:{" "}
                            {selectedAccount.smtp.port}
                          </p>
                          <p>Signature : {selectedAccount.signature.split("\n")[0]}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-4">
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
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{folderCounts[item.id]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-400"
                        onClick={() => setShowAdvancedFilters((current) => !current)}
                      >
                        <span>Options avancées</span>
                        <span>{showAdvancedFilters ? "Masquer" : "Afficher"}</span>
                      </button>
                      {showAdvancedFilters ? (
                        <div className="space-y-4">
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
                          <div>
                            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Permissions</p>
                            <div className="mt-2 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
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
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  {!permissions.view ? (
                    <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      L&apos;accès à la messagerie est restreint. Activez l&apos;autorisation « Consulter les messages » pour afficher le contenu.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition focus-within:border-blue-400 dark:border-zinc-800 dark:bg-zinc-950">
                            <Search className="h-4 w-4 text-zinc-400" />
                            <input
                              type="search"
                              placeholder="Rechercher dans l&apos;objet ou le contenu"
                              value={threadQuery}
                              onChange={(event) => setThreadQuery(event.target.value)}
                              className="w-full bg-transparent outline-none"
                            />
                          </div>
                          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                              Conversations
                            </div>
                            <div className="max-h-[420px] divide-y divide-zinc-200 overflow-y-auto text-sm dark:divide-zinc-800">
                              {filteredThreads.length === 0 ? (
                                <p className="p-4 text-xs text-zinc-500 dark:text-zinc-400">
                                  Aucun message dans ce dossier.
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
                        </div>

                        <div className="space-y-4">
                          {selectedThread ? (
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="flex flex-col gap-3 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                        {selectedThread.subject}
                                      </h3>
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {linkedEntityDescription}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                    .map((message) => (
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
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={clsx(
                                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                                message.format === "html"
                                                  ? "border-blue-400 text-blue-500 dark:border-blue-400/60 dark:text-blue-200"
                                                  : "border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-300",
                                              )}
                                            >
                                              {message.format === "html" ? "HTML" : "Texte"}
                                            </span>
                                            <time>
                                              {DATE_TIME_FORMATTER.format(new Date(message.createdAt))}
                                            </time>
                                          </div>
                                        </header>
                                        <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                                          {message.format === "html" && message.bodyHtml ? (
                                            <div
                                              className="prose prose-sm max-w-none text-zinc-700 dark:prose-invert"
                                              dangerouslySetInnerHTML={{ __html: extractBodyHtml(message.bodyHtml) }}
                                            />
                                          ) : (
                                            <div className="whitespace-pre-wrap">{message.body}</div>
                                          )}
                                        </div>
                                        {(message.requestReadReceipt || message.trackLinks || message.scheduledFor) && (
                                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-blue-600 dark:text-blue-300">
                                            {message.requestReadReceipt ? (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 dark:bg-blue-500/20">
                                                <ShieldCheck className="h-3 w-3" /> Accusé de réception
                                              </span>
                                            ) : null}
                                            {message.trackLinks ? (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 dark:bg-blue-500/20">
                                                <Sparkles className="h-3 w-3" /> Suivi des clics
                                              </span>
                                            ) : null}
                                            {message.scheduledFor ? (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                                                <CalendarClock className="h-3 w-3" /> Envoi prévu le {formatDateTimeInput(message.scheduledFor)}
                                              </span>
                                            ) : null}
                                          </div>
                                        )}
                                        {message.attachments.length > 0 ? (
                                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                            <Paperclip className="h-3.5 w-3.5" />
                                            {message.attachments.map((attachment) => (
                                              <span
                                                key={attachment.id}
                                                className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700"
                                              >
                                                <Paperclip className="h-3 w-3" />
                                                {attachment.name}
                                                <span className="text-[10px] text-zinc-400">{formatBytes(attachment.size)}</span>
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
                                    ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                              Sélectionnez une conversation pour afficher son contenu.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      <MessageSquare className="h-4 w-4" /> Rédaction
                    </h3>
                    <div className="mt-3 grid gap-3 text-sm">
                      {professionalTemplate ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200">
                          <div className="space-y-1">
                            <p className="font-semibold">Besoin d&apos;un rendu professionnel ?</p>
                            <p className="text-[11px] text-blue-600/80 dark:text-blue-200/80">
                              Insérez un modèle HTML responsive avec en-tête, boutons d&apos;action et mentions légales en un clic.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 border-blue-400 text-blue-600 hover:bg-blue-100 dark:border-blue-300 dark:text-blue-100"
                            onClick={() => handleInsertTemplate(professionalTemplate)}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Modèle professionnel
                          </Button>
                        </div>
                      ) : null}
                      <label className="block">
                        <span className="label">À</span>
                        <input
                          className="input"
                          value={composer.to}
                          onChange={(event) =>
                            setComposer((current) => ({ ...current, to: event.target.value }))
                          }
                          placeholder="destinataire@example.com"
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
                        />
                      </label>
                      <label className="block">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="label">Message</span>
                          <div className="flex items-center gap-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() =>
                                setComposer((current) => ({
                                  ...current,
                                  format: "text",
                                  body: current.body || stripHtml(current.bodyHtml),
                                }))
                              }
                              className={clsx(
                                "rounded-full px-3 py-1 transition",
                                composer.format === "text"
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300",
                              )}
                            >
                              Texte enrichi
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setComposer((current) => ({
                                  ...current,
                                  format: "html",
                                  bodyHtml: current.bodyHtml || textToHtml(current.body || ""),
                                  body: stripHtml(current.bodyHtml || textToHtml(current.body || "")),
                                }))
                              }
                              className={clsx(
                                "rounded-full px-3 py-1 transition",
                                composer.format === "html"
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300",
                              )}
                            >
                              HTML avancé
                            </button>
                          </div>
                        </div>
                        {composer.format === "html" ? (
                          <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <textarea
                              className="input min-h-[220px] font-mono text-xs"
                              value={composer.bodyHtml}
                              onChange={(event) => {
                                const value = event.target.value;
                                setComposer((current) => ({
                                  ...current,
                                  bodyHtml: value,
                                  body: stripHtml(value),
                                }));
                              }}
                              placeholder="Collez ou rédigez votre contenu HTML (tableaux, styles inline, CTA...)"
                            />
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
                              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-200">Prévisualisation HTML</span>
                                <span>{composer.bodyHtml ? `${stripHtml(composer.bodyHtml).length} caractères` : "Aucun contenu"}</span>
                              </div>
                              <div className="mt-3 rounded-lg bg-white p-3 text-sm text-zinc-700 shadow-inner dark:bg-zinc-950 dark:text-zinc-200">
                                {composer.bodyHtml ? (
                                  <div
                                    className="prose prose-sm max-w-none dark:prose-invert"
                                    dangerouslySetInnerHTML={{ __html: extractBodyHtml(composer.bodyHtml) }}
                                  />
                                ) : (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Ajoutez votre structure HTML ou importez le modèle professionnel pour démarrer plus vite.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <textarea
                            ref={composer.format === "text" ? bodyRef : undefined}
                            className="input min-h-[160px]"
                            value={composer.body}
                            onChange={(event) =>
                              setComposer((current) => ({ ...current, body: event.target.value }))
                            }
                            placeholder="Rédigez votre message en utilisant les variables dynamiques..."
                          />
                        )}
                      </label>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(event) => handleAddAttachment(event.target.files)}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Paperclip className="h-3.5 w-3.5" /> Joindre un fichier
                          </Button>
                          {composer.attachments.length > 0 ? (
                            <span className="text-[11px] text-zinc-400">
                              {composer.attachments.length} pièce(s) • {formatBytes(totalAttachmentSize)}
                            </span>
                          ) : null}
                        </div>
                        {composer.attachments.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {composer.attachments.map((attachment) => (
                              <span
                                key={attachment.id}
                                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                              >
                                <Paperclip className="h-3 w-3" />
                                <span className="font-medium text-zinc-700 dark:text-zinc-200">{attachment.name}</span>
                                <span className="text-[11px] text-zinc-400">{formatBytes(attachment.size)}</span>
                                <button
                                  type="button"
                                  className="text-[11px] text-red-500 hover:underline"
                                  onClick={() => removeAttachment(attachment.id)}
                                >
                                  Supprimer
                                </button>
                                <button
                                  type="button"
                                  className="text-[11px] text-blue-500 hover:underline"
                                  onClick={() => toggleAttachmentInline(attachment.id)}
                                >
                                  {attachment.inline ? "Intégrer" : "Pièce jointe"}
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-200">Options avancées</span>
                          <span className="text-[11px] text-zinc-400">Planifiez vos envois et suivez les interactions</span>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <label className="flex items-center gap-2">
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
                            Demander un accusé de réception
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={composer.trackLinks}
                              onChange={() =>
                                setComposer((current) => ({
                                  ...current,
                                  trackLinks: !current.trackLinks,
                                }))
                              }
                            />
                            Suivre les clics sur les liens
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={composer.scheduleSend}
                              onChange={() =>
                                setComposer((current) => ({
                                  ...current,
                                  scheduleSend: !current.scheduleSend,
                                  scheduledFor: !current.scheduleSend
                                    ? current.scheduledFor ?? toDatetimeLocalInput(new Date(Date.now() + 30 * 60 * 1000))
                                    : null,
                                }))
                              }
                            />
                            Programmer l&apos;envoi
                          </label>
                        </div>
                        {composer.scheduleSend ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <input
                              type="datetime-local"
                              className="input w-full sm:w-auto"
                              value={composer.scheduledFor ?? ""}
                              onChange={(event) =>
                                setComposer((current) => ({
                                  ...current,
                                  scheduledFor: event.target.value,
                                }))
                              }
                              min={toDatetimeLocalInput(new Date())}
                            />
                            <span className="text-[11px] text-zinc-400">
                              Fuseau local — {formatDateTimeInput(composer.scheduledFor)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">Aperçu instantané</span>
                        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-100">
                          {composerPreview(composer) || "Commencez à écrire pour générer un aperçu lisible par le destinataire."}
                        </p>
                      </div>
                      {composer.error ? (
                        <p className="text-xs text-red-500">{composer.error}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          className="gap-2"
                          onClick={() => handleSendMessage()}
                          disabled={composer.sending}
                        >
                          <Send className="h-4 w-4" />
                          Envoyer
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => handleSaveDraft()}
                          disabled={composer.sending}
                        >
                          <Tag className="h-4 w-4" />
                          Enregistrer le brouillon
                        </Button>
                        <Button
                          variant="ghost"
                          className="gap-2"
                          onClick={() => resetComposer()}
                          disabled={composer.sending}
                        >
                          <Trash2 className="h-4 w-4" />
                          Effacer
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Variables dynamiques
                    </h2>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Cliquez pour insérer dans le message
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
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

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <Sparkles className="h-4 w-4" /> Réponses rapides
                  </h2>
                  <div className="mt-3 grid gap-3 text-sm">
                    {!canManageTemplates ? (
                      <p className="text-xs text-amber-600 dark:text-amber-300">
                        Lecture seule : l&apos;insertion est désactivée pour votre rôle.
                      </p>
                    ) : null}
                    {quickTemplates.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Aucun modèle disponible pour ce compte.
                      </p>
                    ) : (
                      quickTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                {template.name}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Sujet : {template.subject}
                              </p>
                            </div>
                            <span
                              className={clsx(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                template.format === "html"
                                  ? "border-blue-400 text-blue-500 dark:border-blue-400/60 dark:text-blue-200"
                                  : "border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-300",
                              )}
                            >
                              {template.format === "html" ? "HTML" : "Texte"}
                            </span>
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
                            {template.format === "html"
                              ? `${stripHtml(template.body).slice(0, 160)}...`
                              : template.body}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
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
                                  <span
                                    className={clsx(
                                      "rounded-full border px-3 py-0.5 text-[10px] font-semibold",
                                      template.format === "html"
                                        ? "border-blue-400 text-blue-500 dark:border-blue-400/60 dark:text-blue-200"
                                        : "border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-300",
                                    )}
                                  >
                                    {template.format === "html" ? "HTML" : "Texte"}
                                  </span>
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
                              {template.format === "html" ? (
                                <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 shadow-inner dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                  <div
                                    className="prose prose-xs max-w-none dark:prose-invert"
                                    dangerouslySetInnerHTML={{ __html: extractBodyHtml(template.body) }}
                                  />
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
                                  {template.body}
                                </div>
                              )}
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
