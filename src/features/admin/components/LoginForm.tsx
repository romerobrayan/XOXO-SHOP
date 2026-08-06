"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PANEL_HOME } from "@/features/admin/paths";
import { signIn } from "@/lib/auth-client";

const labelClass = "mb-2 block text-sm font-medium text-cuerpo";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);

        const { error: signInError } = await signIn.email({ email, password });

        if (signInError) {
          // Deliberately one message for every failure. Distinguishing "no
          // such account" from "wrong password" tells an attacker which
          // emails are staff, and the owner already knows her own address.
          setError("Correo o contraseña incorrectos.");
          setPending(false);
          return;
        }

        router.replace(PANEL_HOME);
        router.refresh();
      }}
    >
      <label>
        <span className={labelClass}>Correo</span>
        <Input
          required
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label>
        <span className={labelClass}>Contraseña</span>
        <Input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
