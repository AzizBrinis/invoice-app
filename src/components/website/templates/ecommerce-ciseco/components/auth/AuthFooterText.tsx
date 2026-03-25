import type { ReactNode } from "react";

type AuthFooterTextProps = {
  children: ReactNode;
};

export function AuthFooterText({ children }: AuthFooterTextProps) {
  return <p className="text-center text-xs text-slate-500">{children}</p>;
}
