"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:text-red-600"
      loading={pending}
      onClick={() => startTransition(async () => {
        await signOutAction();
      })}
    >
      <LogOut className="h-4 w-4" />
      Déconnexion
    </Button>
  );
}
