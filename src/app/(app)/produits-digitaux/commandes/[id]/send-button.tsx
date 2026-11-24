"use client";

import { Send } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Submit button of the "Envoyer" form: confirmation, then disabled while sending. */
export function SendButton({ recipient, disabled }: { recipient: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      onClick={(event) => {
        if (!window.confirm(`Envoyer l’e-mail, la facture et les licences à ${recipient} ?`)) {
          event.preventDefault();
        }
      }}
      className="w-full sm:w-auto"
    >
      <Send className="h-4 w-4" aria-hidden="true" />
      {pending ? "Envoi…" : "Envoyer au client"}
    </Button>
  );
}
