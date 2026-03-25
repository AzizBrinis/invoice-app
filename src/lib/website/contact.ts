export const CONTACT_SOCIAL_ICON_VALUES = [
  "facebook",
  "instagram",
  "linkedin",
  "twitter",
  "youtube",
  "telegram",
  "whatsapp",
  "github",
] as const;

export type ContactSocialIcon = (typeof CONTACT_SOCIAL_ICON_VALUES)[number];

export type ContactSocialLink = {
  id: string;
  label: string;
  href: string;
  icon: ContactSocialIcon;
};

export const CONTACT_SOCIAL_ICON_OPTIONS: Array<{
  value: ContactSocialIcon;
  label: string;
  color: string;
}> = [
  { value: "facebook", label: "Facebook", color: "#1877f2" },
  { value: "instagram", label: "Instagram", color: "#e1306c" },
  { value: "linkedin", label: "LinkedIn", color: "#0a66c2" },
  { value: "twitter", label: "X / Twitter", color: "#111827" },
  { value: "youtube", label: "YouTube", color: "#ff0000" },
  { value: "telegram", label: "Telegram", color: "#2aabee" },
  { value: "whatsapp", label: "WhatsApp", color: "#22c55e" },
  { value: "github", label: "GitHub", color: "#111827" },
];

export const CONTACT_SOCIAL_ICON_COLORS: Record<ContactSocialIcon, string> =
  CONTACT_SOCIAL_ICON_OPTIONS.reduce(
    (acc, option) => {
      acc[option.value] = option.color;
      return acc;
    },
    {} as Record<ContactSocialIcon, string>,
  );

export const CONTACT_SOCIAL_ICON_LABELS: Record<ContactSocialIcon, string> =
  CONTACT_SOCIAL_ICON_OPTIONS.reduce(
    (acc, option) => {
      acc[option.value] = option.label;
      return acc;
    },
    {} as Record<ContactSocialIcon, string>,
  );
