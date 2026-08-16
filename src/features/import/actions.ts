"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/features/admin/session";
import { assertCloudinaryConfigured } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/safe-action";
import { DEFAULT_PRICING } from "./pricing";
import {
  ensureCatalogCategories,
  promoteStagedProduct,
  type PromoteEntry,
} from "./promote-core";
import { publishStagedProductSchema } from "./schemas";
import { stagedProductSchema } from "./staging";

export type PublishResult =
  | {
      ok: true;
      action: "created" | "updated";
      productId: string;
      slug: string;
      minPriceCents: number;
      warnings: string[];
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "PAYLOAD_INVALID" | "CLOUDINARY_MISSING" | "PUBLISH_FAILED";
      message?: string;
    };

// The button that used to be `npm run import:promote -- --neon`: same shared
// core, same idempotency by supplierRef, same photos re-hosted on Cloudinary.
// The old guardrail asked for the client's approval before touching the
// database the deployment reads — here the person pressing Publicar IS the
// client, so the approval is the click.
export const publishStagedProduct = actionClient
  .inputSchema(publishStagedProductSchema)
  .action(async ({ parsedInput }): Promise<PublishResult> => {
    await requireStaff();
    const input = parsedInput;

    const row = await db.supplierStagingProduct.findUnique({
      where: { id: input.stagingId },
    });
    if (!row) return { ok: false, code: "NOT_FOUND" };

    const parsed = stagedProductSchema.safeParse(row.payload);
    if (!parsed.success) {
      return {
        ok: false,
        code: "PAYLOAD_INVALID",
        message: parsed.error.issues[0]?.message,
      };
    }
    const staged = parsed.data;

    try {
      assertCloudinaryConfigured();
    } catch {
      // The deployed panel cannot re-host photos without the credential —
      // stop before writing anything, with a message an owner can relay.
      return { ok: false, code: "CLOUDINARY_MISSING" };
    }

    const pricing =
      input.pricingMode === "margen"
        ? {
            ...DEFAULT_PRICING,
            marginPct: {
              ...DEFAULT_PRICING.marginPct,
              [staged.supplier]: input.marginPct ?? 0,
            },
          }
        : DEFAULT_PRICING;

    const entry: PromoteEntry = {
      supplierRef: staged.supplierRef,
      categorySlug: input.categorySlug,
      brand: input.brand || undefined,
      initialStock: input.initialStock,
      ...(input.pricingMode === "manual"
        ? { salePriceCOP: input.salePriceCOP }
        : {}),
    };

    try {
      await ensureCatalogCategories(db);
      const outcome = await promoteStagedProduct(db, {
        staged,
        entry,
        pricing,
        // Re-publishing an already-published product refreshes catalog data
        // but never rewrites prices the owner may have tuned by hand, and
        // never touches stock — the same contract the CLI promote keeps.
      });

      await db.supplierStagingProduct.update({
        where: { id: row.id },
        data: {
          status: "PUBLISHED",
          publishedProductId: outcome.productId,
          publishedAt: new Date(),
        },
      });

      revalidatePath("/admin/proveedores");
      revalidatePath(`/admin/proveedores/${row.id}`);
      revalidatePath("/admin/productos");
      revalidatePath(`/admin/productos/${outcome.productId}`);
      revalidatePath("/tienda");
      revalidatePath(`/tienda/${outcome.slug}`);
      revalidatePath("/");

      return {
        ok: true,
        action: outcome.action,
        productId: outcome.productId,
        slug: outcome.slug,
        minPriceCents: outcome.minPriceCents,
        warnings: outcome.warnings,
      };
    } catch (e) {
      console.error("[proveedores] publish failed", e);
      return {
        ok: false,
        code: "PUBLISH_FAILED",
        message: e instanceof Error ? e.message : undefined,
      };
    }
  });
