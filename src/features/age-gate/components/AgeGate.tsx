"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AGE_CONSENT_COOKIE,
  AGE_CONSENT_MAX_AGE_SECONDS,
  AGE_CONSENT_TIMESTAMP_COOKIE,
  AGE_DISMISS_COOKIE,
} from "../consent";

// The cookies are external state: read them via useSyncExternalStore so the
// modal only opens on the client, after hydration, when neither consent nor a
// session dismissal is present.
const subscribe = () => () => {};
const isClosed = () => {
  const cookies = document.cookie.split("; ");
  return (
    cookies.includes(`${AGE_CONSENT_COOKIE}=1`) ||
    cookies.includes(`${AGE_DISMISS_COOKIE}=1`)
  );
};
// On the server, assume closed so no modal is part of the SSR payload.
const isClosedOnServer = () => true;

export function AgeGate() {
  const closed = useSyncExternalStore(subscribe, isClosed, isClosedOnServer);
  const [dismissed, setDismissed] = useState(false);

  function confirm() {
    const attrs = `path=/; max-age=${AGE_CONSENT_MAX_AGE_SECONDS}; samesite=lax`;
    document.cookie = `${AGE_CONSENT_COOKIE}=1; ${attrs}`;
    document.cookie = `${AGE_CONSENT_TIMESTAMP_COOKIE}=${Date.now()}; ${attrs}`;
    setDismissed(true);
  }

  // ESC / overlay. Not consent — a session cookie only, so the gate doesn't
  // re-trap keyboard and screen reader focus on every navigation.
  function dismiss() {
    document.cookie = `${AGE_DISMISS_COOKIE}=1; path=/; samesite=lax`;
    setDismissed(true);
  }

  return (
    <Dialog
      open={!closed && !dismissed}
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <p className="font-mono text-micro uppercase text-bone/60">XOXO</p>
          <DialogTitle>Contenido para mayores de 18 años</DialogTitle>
          <DialogDescription>
            XOXO vende productos para adultos. Al continuar confirmas que
            tienes 18 años o más.
          </DialogDescription>
          <p className="text-small text-bone/70">
            No pedimos tu fecha de nacimiento. Solo guardamos tu confirmación
            en este navegador.
          </p>
        </DialogHeader>
        {/* Primary first — in the DOM and visually — so initial focus lands on
            confirm, never on the exit link. */}
        <DialogFooter className="flex-col sm:flex-col sm:justify-start">
          <Button variant="neon" className="w-full" onClick={confirm}>
            Soy mayor de 18
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <a href="https://www.google.com">Salir</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
