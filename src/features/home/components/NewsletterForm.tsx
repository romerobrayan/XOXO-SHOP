"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Formulario de la guía para principiantes. Fase 0: estado de éxito
// client-side, sin backend todavía — igual que el prototipo del handoff.
export function NewsletterForm() {
  const [sent, setSent] = useState(false);

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSent(true);
        }}
        className="mx-auto flex w-full max-w-[440px] gap-3"
      >
        <label className="sr-only" htmlFor="newsletter-email">
          Correo electrónico
        </label>
        <Input
          id="newsletter-email"
          type="email"
          required
          placeholder="tu@correo.com"
        />
        <Button type="submit" className="shrink-0 whitespace-nowrap">
          Recibir guía
        </Button>
      </form>
      <p aria-live="polite" className="mt-4 min-h-7">
        {sent && <Badge variant="exito">Enviada — revisa tu correo</Badge>}
      </p>
    </div>
  );
}
