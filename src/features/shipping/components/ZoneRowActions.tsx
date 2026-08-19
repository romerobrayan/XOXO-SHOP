"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteShippingZone, setShippingZoneActive } from "../actions";

/** One-tap activate/pause on each row, plus a confirmed delete. A zone keeps
 * no history — orders snapshot the name and the cents they were charged — so
 * deleting one is safe, which is why it is offered at all. */
export function ZoneRowActions({
  zoneId,
  name,
  isActive,
}: {
  zoneId: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const toggle = useAction(setShippingZoneActive, {
    onSuccess: () => router.refresh(),
  });
  const remove = useAction(deleteShippingZone, {
    onSuccess: () => router.refresh(),
  });
  const pending = toggle.isPending || remove.isPending;

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-suave">¿Borrar {name}?</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => remove.execute({ zoneId })}
        >
          Sí, borrar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => toggle.execute({ zoneId, isActive: !isActive })}
      >
        {toggle.isPending ? "…" : isActive ? "Pausar" : "Activar"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        Borrar
      </Button>
    </div>
  );
}
