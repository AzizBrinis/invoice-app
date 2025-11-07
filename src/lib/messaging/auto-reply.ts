export const DEFAULT_AUTO_REPLY_SUBJECT =
  "Nous avons bien reçu votre email";

export const DEFAULT_AUTO_REPLY_BODY =
  "Nous avons bien reçu votre email. Nous vous répondrons dans un délai maximum de 24h (hors week-ends et jours fériés).";

export const DEFAULT_VACATION_SUBJECT = "Je suis actuellement en congé";

export const DEFAULT_VACATION_BODY =
  "Je suis actuellement en congé jusqu'au {{return_date}}. Pour toute urgence, vous pouvez contacter : {{backup_email}}.";

export const VACATION_PLACEHOLDER_TOKENS = ["{{return_date}}", "{{backup_email}}"] as const;

export type VacationPlaceholder = (typeof VACATION_PLACEHOLDER_TOKENS)[number];

type VacationTemplateOptions = {
  returnDate?: string | null;
  backupEmail?: string | null;
  defaultReturnText?: string;
  defaultBackupText?: string;
};

export function renderVacationTemplate(
  template: string,
  options: VacationTemplateOptions = {},
): string {
  const base = template ?? "";
  const fallbackReturn = options.defaultReturnText ?? "bientôt";
  const fallbackBackup = options.defaultBackupText ?? "notre équipe support";

  const replacements: Record<VacationPlaceholder, string> = {
    "{{return_date}}": (options.returnDate ?? fallbackReturn).trim(),
    "{{backup_email}}": (options.backupEmail ?? fallbackBackup).trim(),
  };

  let output = base;
  for (const token of VACATION_PLACEHOLDER_TOKENS) {
    const pattern = new RegExp(token.replace(/[{}]/g, "\\$&"), "gi");
    output = output.replace(pattern, replacements[token]);
  }
  return output;
}
