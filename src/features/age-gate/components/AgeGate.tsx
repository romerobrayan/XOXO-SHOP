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
} from "../consent";

// The cookie is external state: read it via useSyncExternalStore so the modal
// only opens on the client, after hydration, when consent is absent.
const subscribe = () => () => {};
const hasConsent = () =>
  document.cookie.split("; ").includes(`${AGE_CONSENT_COOKIE}=1`);
// On the server, assume consent so no modal is part of the SSR payload.
const hasConsentOnServer = () => true;

export function AgeGate() {
  const consented = useSyncExternalStore(
    subscribe,
    hasConsent,
    hasConsentOnServer,
  );
  const [dismissed, setDismissed] = useState(false);

  function confirm() {
    const attrs = `path=/; max-age=${AGE_CONSENT_MAX_AGE_SECONDS}; samesite=lax`;
    document.cookie = `${AGE_CONSENT_COOKIE}=1; ${attrs}`;
    document.cookie = `${AGE_CONSENT_TIMESTAMP_COOKIE}=${Date.now()}; ${attrs}`;
    setDismissed(true);
  }

  return (
    <Dialog
      open={!consented && !dismissed}
      onOpenChange={(open) => {
        if (!open) setDismissed(true);
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Contenido para mayores de 18 años</DialogTitle>
          <DialogDescription>
            Esta tienda vende productos para adultos. Al continuar confirmas que
            tienes 18 años o más.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" asChild>
            <a href="https://www.google.com">Salir</a>
          </Button>
          <Button onClick={confirm}>Soy mayor de 18</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
