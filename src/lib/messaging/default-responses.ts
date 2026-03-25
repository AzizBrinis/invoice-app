import type { SavedResponseFormat } from "@/lib/messaging/saved-responses";

export type DefaultSavedResponse = {
  slug: string;
  title: string;
  description: string;
  content: string;
  format: SavedResponseFormat;
};

const EMAIL_FONT_FAMILY =
  "'Segoe UI','Helvetica Neue',Arial,'Liberation Sans',sans-serif";
const HEADING_COLOR = "#0f172a";
const BODY_TEXT_COLOR = "#334155";
const MUTED_TEXT_COLOR = "#64748b";

export const DEFAULT_SAVED_RESPONSES: DefaultSavedResponse[] = [
  {
    slug: "default-quote-template",
    title: "Envoi d'un devis",
    description: "Modèle HTML élégant pour transmettre un devis avec un résumé clair.",
    format: "HTML",
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;font-family:${EMAIL_FONT_FAMILY};color:${HEADING_COLOR};">
  <tr>
    <td style="padding-bottom:12px;">
      <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Proposition commerciale</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:22px;font-weight:600;color:${HEADING_COLOR};">
      Devis pour {{client_name}}
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;">
      <span style="display:inline-block;padding:8px 16px;border-radius:999px;background-color:#1d4ed8;color:#ffffff;font-size:13px;font-weight:600;">Devis n° {{quote_number}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Bonjour {{client_name}},
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Vous trouverez ci-joint le devis établi le {{quote_date}} pour {{project_name}}. Nous restons disponibles pour ajuster cette proposition et répondre à vos questions.
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #d8e3f2;border-radius:12px;background-color:#f9fbff;">
        <tr>
          <td style="padding:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
              <tr>
                <td colspan="2" style="font-size:15px;font-weight:600;color:#1d4ed8;padding-bottom:12px;">
                  Résumé du devis
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-bottom:1px solid #e2e8f0;">
                  Montant HT
                </td>
                <td style="padding:12px 0;font-size:14px;color:${HEADING_COLOR};font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                  {{total_ht}}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-bottom:1px solid #e2e8f0;">
                  TVA
                </td>
                <td style="padding:12px 0;font-size:14px;color:${HEADING_COLOR};font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                  {{total_tva}}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-bottom:1px solid #e2e8f0;">
                  Montant TTC
                </td>
                <td style="padding:12px 0;font-size:18px;color:#1d4ed8;font-weight:700;text-align:right;border-bottom:1px solid #e2e8f0;">
                  {{total_ttc}}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-top:1px solid #e2e8f0;">
                  Validité
                </td>
                <td style="padding:12px 0;font-size:14px;color:${HEADING_COLOR};font-weight:600;text-align:right;border-top:1px solid #e2e8f0;border-bottom:0;">
                  {{quote_valid_until}}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Si vous souhaitez planifier une réunion pour détailler les prochaines étapes, faites-le nous savoir.
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:8px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Merci pour votre confiance.
    </td>
  </tr>
  <tr>
    <td style="font-size:15px;line-height:1.6;color:${HEADING_COLOR};font-weight:600;">
      {{company_name}}
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_email}} &middot; {{company_phone}}
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_address}}
    </td>
  </tr>
</table>`,
  },
  {
    slug: "default-invoice-template",
    title: "Envoi d'une facture",
    description: "Modèle HTML premium pour transmettre une facture avec rappel du règlement.",
    format: "HTML",
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;font-family:${EMAIL_FONT_FAMILY};color:${HEADING_COLOR};">
  <tr>
    <td style="padding-bottom:12px;">
      <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Facturation</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:22px;font-weight:600;color:${HEADING_COLOR};">
      Facture {{invoice_number}}
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;">
      <span style="display:inline-block;padding:8px 16px;border-radius:999px;background-color:#e0f2fe;color:#0369a1;font-size:13px;font-weight:600;">Émise le {{invoice_date}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Bonjour {{client_name}},
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Merci de trouver ci-joint la facture correspondant à {{project_name}}. Nous apprécions votre confiance et restons à votre disposition pour toute précision.
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #d8e3f2;border-radius:12px;background-color:#f9fbff;">
        <tr>
          <td style="padding:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
              <tr>
                <td colspan="2" style="font-size:15px;font-weight:600;color:#1d4ed8;padding-bottom:12px;">
                  Récapitulatif de la facture
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-bottom:1px solid #e2e8f0;">
                  Montant TTC
                </td>
                <td style="padding:12px 0;font-size:18px;color:#1d4ed8;font-weight:700;text-align:right;border-bottom:1px solid #e2e8f0;">
                  {{total_ttc}}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-bottom:1px solid #e2e8f0;">
                  Montant payé
                </td>
                <td style="padding:12px 0;font-size:14px;color:${HEADING_COLOR};font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                  {{amount_paid}}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-bottom:1px solid #e2e8f0;">
                  Solde restant
                </td>
                <td style="padding:12px 0;font-size:14px;color:#dc2626;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                  {{balance_due}}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-top:1px solid #e2e8f0;">
                  Échéance
                </td>
                <td style="padding:12px 0;font-size:14px;color:${HEADING_COLOR};font-weight:600;text-align:right;border-top:1px solid #e2e8f0;border-bottom:0;">
                  {{due_date}}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Merci d'effectuer le règlement selon les modalités habituelles. Pour un virement, pensez à rappeler la référence <strong>{{invoice_number}}</strong>.
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Nous restons disponibles pour toute question complémentaire.
    </td>
  </tr>
  <tr>
    <td style="font-size:15px;line-height:1.6;color:${HEADING_COLOR};font-weight:600;">
      {{company_name}}
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_email}} &middot; {{company_phone}}
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_address}}
    </td>
  </tr>
</table>`,
  },
  {
    slug: "default-receipt-template",
    title: "Envoi d'un reçu",
    description: "Modèle HTML élégant pour transmettre un reçu de paiement client.",
    format: "HTML",
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;font-family:${EMAIL_FONT_FAMILY};color:${HEADING_COLOR};">
  <tr>
    <td style="padding-bottom:12px;">
      <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#dcfce7;color:#166534;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Reçu de paiement</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:22px;font-weight:600;color:${HEADING_COLOR};">
      Reçu {{receipt_number}}
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;">
      <span style="display:inline-block;padding:8px 16px;border-radius:999px;background-color:#ecfccb;color:#3f6212;font-size:13px;font-weight:600;">Paiement du {{payment_date}}</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Bonjour {{client_name}},
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Vous trouverez ci-joint votre reçu de paiement. Ce document confirme le règlement enregistré pour les services suivants : {{services_summary}}.
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #d8e3f2;border-radius:12px;background-color:#f9fbff;">
        <tr>
          <td style="padding:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
              <tr>
                <td colspan="2" style="font-size:15px;font-weight:600;color:#166534;padding-bottom:12px;">
                  Récapitulatif du paiement
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-bottom:1px solid #e2e8f0;">
                  Montant reçu
                </td>
                <td style="padding:12px 0;font-size:18px;color:#166534;font-weight:700;text-align:right;border-bottom:1px solid #e2e8f0;">
                  {{amount_paid}}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-bottom:1px solid #e2e8f0;">
                  Mode de paiement
                </td>
                <td style="padding:12px 0;font-size:14px;color:${HEADING_COLOR};font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0;">
                  {{payment_method}}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:14px;color:${BODY_TEXT_COLOR};border-top:1px solid #e2e8f0;">
                  Référence
                </td>
                <td style="padding:12px 0;font-size:14px;color:${HEADING_COLOR};font-weight:600;text-align:right;border-top:1px solid #e2e8f0;border-bottom:0;">
                  {{payment_reference}}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:16px;font-size:15px;line-height:1.6;color:${BODY_TEXT_COLOR};">
      Merci pour votre règlement.
    </td>
  </tr>
  <tr>
    <td style="font-size:15px;line-height:1.6;color:${HEADING_COLOR};font-weight:600;">
      {{company_name}}
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_email}} &middot; {{company_phone}}
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_address}}
    </td>
  </tr>
</table>`,
  },
  {
    slug: "default-order-created-template",
    title: "Confirmation de commande",
    description: "Modèle HTML premium pour confirmer une commande et guider le client.",
    format: "HTML",
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;font-family:${EMAIL_FONT_FAMILY};color:${HEADING_COLOR};">
  <tr>
    <td style="padding-bottom:12px;">
      <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#e0f2fe;color:#0369a1;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Commande confirmée</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:22px;font-weight:600;color:${HEADING_COLOR};">
      Merci {{customer_name}}, votre commande est confirmée
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Référence <strong>{{order_number}}</strong> · {{order_date}}
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:14px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Nous préparons votre prestation avec le plus grand soin.
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        {{order_items}}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;font-size:16px;font-weight:600;color:${HEADING_COLOR};">
      Total TTC : {{order_total}}
    </td>
  </tr>
  {{bank_transfer_block}}
  {{order_recap_block}}
  <tr>
    <td style="padding-bottom:8px;font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      Une question ? Répondez à cet e-mail, nous vous répondrons rapidement.
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_name}}<br />
      {{company_email}} &middot; {{company_phone}}<br />
      {{company_address}}
    </td>
  </tr>
</table>`,
  },
  {
    slug: "default-order-payment-template",
    title: "Paiement reçu",
    description: "Modèle HTML premium pour confirmer le paiement d'une commande.",
    format: "HTML",
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;font-family:${EMAIL_FONT_FAMILY};color:${HEADING_COLOR};">
  <tr>
    <td style="padding-bottom:12px;">
      <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#dcfce7;color:#166534;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Paiement confirmé</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:22px;font-weight:600;color:${HEADING_COLOR};">
      Votre paiement est bien confirmé
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Commande <strong>{{order_number}}</strong> · Réglé le {{payment_date}}
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Montant réglé : <strong>{{amount_paid}}</strong>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Total TTC : {{order_total}}
    </td>
  </tr>
  {{order_recap_block}}
  <tr>
    <td style="padding-bottom:8px;font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      Merci pour votre confiance.
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_name}}<br />
      {{company_email}} &middot; {{company_phone}}<br />
      {{company_address}}
    </td>
  </tr>
</table>`,
  },
  {
    slug: "default-order-proof-received-template",
    title: "Preuve de virement reçue",
    description: "Modèle HTML premium pour confirmer la réception d'une preuve de virement.",
    format: "HTML",
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;font-family:${EMAIL_FONT_FAMILY};color:${HEADING_COLOR};">
  <tr>
    <td style="padding-bottom:12px;">
      <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#fef9c3;color:#854d0e;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Preuve reçue</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:22px;font-weight:600;color:${HEADING_COLOR};">
      Votre preuve de virement est bien reçue
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Commande <strong>{{order_number}}</strong> · {{proof_date}}
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Total TTC : {{order_total}}
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Nous vérifions le règlement et revenons vers vous rapidement.
    </td>
  </tr>
  {{order_recap_block}}
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_name}}<br />
      {{company_email}} &middot; {{company_phone}}<br />
      {{company_address}}
    </td>
  </tr>
</table>`,
  },
  {
    slug: "default-quote-request-template",
    title: "Demande de devis reçue",
    description: "Modèle HTML pour confirmer la réception d'une demande de devis.",
    format: "HTML",
    content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;font-family:${EMAIL_FONT_FAMILY};color:${HEADING_COLOR};">
  <tr>
    <td style="padding-bottom:12px;">
      <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:#ede9fe;color:#6d28d9;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Demande de devis</span>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:22px;font-weight:600;color:${HEADING_COLOR};">
      Merci {{customer_name}}, votre demande est bien reçue
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:8px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Service : <strong>{{product_name}}</strong>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:12px;font-size:14px;color:${BODY_TEXT_COLOR};">
      Date : {{request_date}}
    </td>
  </tr>
  <tr>
    <td style="padding-bottom:20px;font-size:14px;color:${BODY_TEXT_COLOR};white-space:pre-line;">
      {{request_message}}
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;line-height:1.5;color:${MUTED_TEXT_COLOR};">
      {{company_name}}<br />
      {{company_email}} &middot; {{company_phone}}<br />
      {{company_address}}
    </td>
  </tr>
</table>`,
  },
];
