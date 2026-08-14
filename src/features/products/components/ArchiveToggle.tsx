"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { ProductStatus } from "@/generated/prisma/enums";
import { setProductArchived } from "../actions";

/** The one-tap archive/restore on each list row — the row itself stays a
 * link to the detail. */
export function ArchiveToggle({
  productId,
  status,
}: {
  productId: string;
  status: ProductStatus;
}) {
  const router = useRouter();
  const archived = status === "ARCHIVED";

  const toggle = useAction(setProductArchived, {
    onSuccess: () => router.refresh(),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={toggle.isPending}
      aria-label={archived ? "Restaurar a la tienda" : "Archivar"}
      onClick={() => toggle.execute({ productId, archived: !archived })}
    >
      {toggle.isPending ? "…" : archived ? "Restaurar" : "Archivar"}
    </Button>
  );
}
