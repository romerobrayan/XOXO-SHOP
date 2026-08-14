"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProductStatus } from "@/generated/prisma/enums";
import { deleteProduct, setProductArchived } from "../actions";

// The clear gesture the estado <select> never was: one button to take the
// product off the store, one to bring it back, and — only while the product
// has no history at all — one to truly delete it.
export function ProductLifecycle({
  productId,
  status,
  hasHistory,
}: {
  productId: string;
  status: ProductStatus;
  hasHistory: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = useAction(setProductArchived, {
    onSuccess({ data }) {
      if (data && "ok" in data && data.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage("El producto ya no existe.");
      }
    },
    onError: () => setMessage("No pudimos cambiar el estado."),
  });

  const remove = useAction(deleteProduct, {
    onSuccess({ data }) {
      if (!data) return;
      if (data.ok) {
        router.push("/admin/productos");
        router.refresh();
        return;
      }
      setMessage(
        data.code === "HAS_HISTORY"
          ? "Ya tiene pedidos o movimientos de inventario: se archiva, no se borra."
          : "El producto ya no existe.",
      );
    },
    onError: () => setMessage("No pudimos eliminar el producto."),
  });

  const archived = status === "ARCHIVED";
  const pending = toggle.isPending || remove.isPending;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            toggle.execute({ productId, archived: !archived })
          }
        >
          {toggle.isPending
            ? "Guardando…"
            : archived
              ? "Restaurar a la tienda"
              : "Archivar"}
        </Button>
        <span className="text-[13px] font-light text-tenue">
          {archived
            ? "Está oculto de la tienda; restaurarlo lo vuelve a publicar tal como estaba."
            : "Lo oculta de la tienda al instante. Pedidos, stock e historial quedan intactos."}
        </span>
      </div>

      {!hasHistory ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-linea pt-4">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              setConfirmDelete(false);
              remove.execute({ productId });
            }}
            onBlur={() => setConfirmDelete(false)}
            className={confirmDelete ? "border-error text-error" : "text-error"}
          >
            {remove.isPending
              ? "Eliminando…"
              : confirmDelete
                ? "¿Eliminar de verdad?"
                : "Eliminar definitivamente"}
          </Button>
          <span className="text-[13px] font-light text-tenue">
            Posible solo porque nadie lo ha pedido ni ha movido su inventario.
          </span>
        </div>
      ) : (
        <p className="border-t border-linea pt-4 text-[13px] font-light text-tenue">
          Este producto tiene pedidos o movimientos en el libro, así que no se
          puede eliminar — archivarlo es el camino.
        </p>
      )}

      {message ? (
        <p role="alert" className="text-sm text-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}
