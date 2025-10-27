"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email({ message: "Adresse e-mail invalide" }),
  password: z
    .string()
    .min(8, { message: "Mot de passe requis (8 caractères min.)" }),
  redirectTo: z.string().default("/tableau-de-bord"),
});

export type LoginFormState = {
  message?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

export async function authenticate(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten();
    return {
      message: formErrors[0] ?? "Veuillez corriger les champs signalés.",
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  try {
    const user = await signIn(parsed.data.email, parsed.data.password);
    if (!user) {
      return { message: "Identifiants incorrects" };
    }
  } catch (error) {
    console.error("[authenticate] Échec de la connexion", error);
    return {
      message:
        "Impossible de vous connecter pour le moment. Veuillez réessayer.",
    };
  }

  const safeRedirect = parsed.data.redirectTo.startsWith("/")
    ? parsed.data.redirectTo
    : "/tableau-de-bord";

  redirect(safeRedirect);
}
