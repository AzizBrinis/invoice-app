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
  error?: string;
};

export async function authenticate(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Identifiants invalides";
    return { error: message };
  }

  const user = await signIn(parsed.data.email, parsed.data.password);
  if (!user) {
    return { error: "Identifiants incorrects" };
  }

  const safeRedirect = parsed.data.redirectTo.startsWith("/")
    ? parsed.data.redirectTo
    : "/tableau-de-bord";

  redirect(safeRedirect);
}
