import { ToastProvider } from "@/components/ui/toast-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
