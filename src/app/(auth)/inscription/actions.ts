"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, signIn } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import {
  acceptAccountInvitation,
  getPendingAccountInvitation,
} from "@/server/accounts";

const registerSchema = z
  .object({
    email: z.string().email({ message: "Adresse e-mail invalide" }),
    password: z
      .string()
      .min(8, { message: "Le mot de passe doit contenir au moins 8 caractères" }),
    confirmPassword: z.string(),
    name: z
      .string()
      .min(2, { message: "Le nom doit contenir au moins 2 caractères" })
      .max(100)
      .optional()
      .or(z.literal("")),
    invitationToken: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Les mots de passe ne correspondent pas",
        path: ["confirmPassword"],
      });
    }
  });

export type RegisterFormState = {
  message?: string;
  fieldErrors?: Partial<
    Record<"name" | "email" | "password" | "confirmPassword", string>
  >;
};

export async function registerAction(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = registerSchema.safeParse(raw);

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten();
    return {
      message: formErrors[0] ?? "Veuillez corriger les champs signalés.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    };
  }

  const { email, password, name } = parsed.data;
  const invitationToken = parsed.data.invitationToken?.trim() || null;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        message: "Un compte existe déjà avec cette adresse",
        fieldErrors: {
          email: "Un compte existe déjà avec cette adresse",
        },
      };
    }

    if (invitationToken) {
      const invitation = await getPendingAccountInvitation(invitationToken);
      if (!invitation) {
        return {
          message: "Invitation invalide ou expirée.",
        };
      }

      if (invitation.email !== normalizedEmail) {
        return {
          message: "Utilisez l'adresse e-mail qui a reçu l'invitation.",
          fieldErrors: {
            email: "Cette invitation est liée à une autre adresse e-mail.",
          },
        };
      }
    }

    const passwordHash = await hashPassword(password);
    const billingManagerCount = await prisma.user.count({
      where: {
        role: {
          in: [UserRole.ADMIN, UserRole.ACCOUNTANT],
        },
      },
    });
    const role =
      billingManagerCount === 0 ? UserRole.ADMIN : UserRole.VIEWER;

    const createdUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name && name.length > 0 ? name : null,
        role,
      },
    });

    let activeTenantId: string | undefined;
    if (invitationToken) {
      const invitationContext = await acceptAccountInvitation({
        rawToken: invitationToken,
        userId: createdUser.id,
      });
      activeTenantId = invitationContext.accountId;
    }

    const user = await signIn(email, password, {
      activeTenantId,
    });
    if (!user) {
      console.error("[registerAction] Session non créée après l'inscription");
      return {
        message:
          "Compte créé, mais la connexion automatique a échoué. Veuillez vous connecter manuellement.",
      };
    }
  } catch (error) {
    console.error("[registerAction] Erreur lors de l'inscription", error);
    return {
      message:
        "Impossible de finaliser l'inscription pour le moment. Veuillez réessayer.",
    };
  }

  redirect("/tableau-de-bord");
}
