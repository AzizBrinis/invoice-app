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
];
