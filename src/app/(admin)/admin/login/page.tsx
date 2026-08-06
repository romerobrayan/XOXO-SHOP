import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/admin/components/LoginForm";
import { PANEL_HOME } from "@/features/admin/paths";
import { getStaffSession } from "@/features/admin/session";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getStaffSession()) redirect(PANEL_HOME);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[--color-marfil] px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="logo-wordmark mb-8 text-center text-[18px]">SECRETO</p>
        <div className="rounded-[4px] border border-[--color-linea] bg-[--color-crema] p-6">
          <h1 className="mb-1 font-[family-name:--font-marcellus] text-[24px]">
            Panel
          </h1>
          <p className="mb-6 text-[13px] font-light text-[--color-tinta]">
            Entra con tu correo para ver los pedidos.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
