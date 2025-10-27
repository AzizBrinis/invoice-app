"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

type FormSubmitButtonProps = Omit<ButtonProps, "type" | "loading"> & {
  pendingLabel?: React.ReactNode;
};

export function FormSubmitButton({
  pendingLabel,
  children,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      type="submit"
      loading={pending}
      aria-live="polite"
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
