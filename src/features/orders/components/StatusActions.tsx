"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/generated/prisma/enums";
import { changeOrderStatus } from "../actions";
import { STATUS_LABEL, transitionsFrom } from "../transitions";

export function StatusActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  const { execute, isPending } = useAction(changeOrderStatus, {
    onSuccess({ data }) {
      if (!data) return;
      if (data.ok) {
        setMessage(null);
        router.refresh();
        return;
      }
      if (data.code === "STALE") {
        setMessage(
          `Este pedido ya está en "${
            STATUS_LABEL[data.currentStatus as OrderStatus] ??
            data.currentStatus
          }". Actualizamos la vista.`,
        );
        router.refresh();
        return;
      }
      setMessage("Ese cambio no está permitido desde el estado actual.");
    },
    onError() {
      setMessage("No pudimos cambiar el estado. Intenta de nuevo.");
    },
  });

  const options = transitionsFrom(status);

  if (options.length === 0) {
    return (
      <p className="text-sm font-light text-suave">
        Este pedido está cerrado. No quedan cambios de estado.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((t) => (
          <Button
            key={t.to}
            size="sm"
            variant={t.effect === "release" ? "outline" : "default"}
            disabled={isPending}
            onClick={() => {
              // Native confirm is a blocking dialog and deliberate here: the
              // moves it guards move stock, and she is doing this one-handed.
              if (t.confirm && !window.confirm(t.confirm)) return;
              execute({ orderId, from: status, to: t.to });
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {message ? (
        <p role="status" className="text-sm text-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}
