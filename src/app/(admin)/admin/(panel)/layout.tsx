import Link from "next/link";

import { SignOutButton } from "@/features/admin/components/SignOutButton";
import { PanelNav } from "@/features/admin/components/PanelNav";
import { requireStaff } from "@/features/admin/session";

// Everything inside the (panel) group is staff-only. /admin/login sits outside
// it on purpose — a gate that also guards the door to itself just redirects
// forever.
export default async function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireStaff();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-marfil">
      <header className="border-b border-linea bg-crema">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin/pedidos" className="logo-wordmark text-[15px]">
            SECRETO
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-[13px] font-light text-suave sm:inline">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <PanelNav />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
