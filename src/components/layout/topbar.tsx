import { UserCircle } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import type { NavItem } from "@/components/layout/sidebar-nav";

type TopbarProps = {
  items: NavItem[];
  companyName: string;
  user: {
    name?: string | null;
    email: string;
  };
};

export function Topbar({ items, companyName, user }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <MobileNav items={items} />
          <div className="hidden flex-col lg:flex">
            <span className="text-xs uppercase tracking-wide text-blue-600">
              {companyName}
            </span>
            <span className="text-sm font-semibold text-zinc-900">
              Espace d&apos;administration
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 sm:flex">
            <UserCircle className="h-4 w-4" />
            <div className="flex flex-col">
              <span className="font-medium">
                {user.name ?? "Administrateur"}
              </span>
              <span className="text-xs text-zinc-500">{user.email}</span>
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
