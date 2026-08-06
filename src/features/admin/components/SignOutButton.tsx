"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LOGIN_PATH } from "@/features/admin/paths";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.replace(LOGIN_PATH);
        router.refresh();
      }}
      className="text-[13px] font-medium tracking-boton text-cuerpo uppercase transition-colors duration-150 hover:text-vino disabled:opacity-45"
    >
      Salir
    </button>
  );
}
