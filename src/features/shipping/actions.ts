"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/features/admin/session";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/safe-action";
import {
  createShippingZoneSchema,
  deleteShippingZoneSchema,
  setShippingZoneActiveSchema,
  updateShippingZoneSchema,
  type ShippingZoneKindInput,
} from "./schemas";

// Every action gates on requireStaff() first — the layout only proves who
// loaded the page — and revalidates the three surfaces a zone change moves:
// the panel list, the published shipping policy, and the checkout that
// quotes against it.
function revalidateZones() {
  revalidatePath("/admin/domicilios");
  revalidatePath("/legal/envios");
  revalidatePath("/checkout");
}

// Expected outcomes travel in the typed result; the UI branches on `code`.
export type ShippingZoneResult =
  | { ok: true; zoneId: string }
  // Another zone already covers one of these locations. Two zones claiming
  // the same barrio would mean two prices for one address, so the database
  // refuses it and the panel says which one is taken.
  | { ok: false; code: "AREA_TAKEN"; areas: string[] }
  // One general fee per department, one national fee, period.
  | { ok: false; code: "KIND_TAKEN"; name: string };

/**
 * GENERAL and NATIONAL are "everything else" buckets, so a second one is not
 * a preference but an ambiguity: which price wins? Guarded here rather than
 * with a unique index because Postgres treats NULL departments as distinct,
 * which is exactly the case that needs blocking.
 */
async function conflictingBucket(
  kind: ShippingZoneKindInput,
  department: string | undefined,
  excludeZoneId?: string,
) {
  if (kind === "SPECIFIC") return null;
  return db.shippingZone.findFirst({
    where: {
      kind,
      department: kind === "NATIONAL" ? null : (department ?? null),
      ...(excludeZoneId ? { id: { not: excludeZoneId } } : {}),
    },
    select: { name: true },
  });
}

/** Prisma reports the unique violation, not which value tripped it. */
async function takenAreas(
  department: string,
  matchKeys: string[],
  excludeZoneId?: string,
): Promise<string[]> {
  const rows = await db.shippingZoneArea.findMany({
    where: {
      department,
      matchKey: { in: matchKeys },
      ...(excludeZoneId ? { zoneId: { not: excludeZoneId } } : {}),
    },
    select: { label: true },
  });
  return rows.map((r) => r.label);
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export const createShippingZone = actionClient
  .inputSchema(createShippingZoneSchema)
  .action(async ({ parsedInput }): Promise<ShippingZoneResult> => {
    await requireStaff();
    const { name, kind, department, priceCents, note, areas, isActive } =
      parsedInput;

    const bucket = await conflictingBucket(kind, department);
    if (bucket) return { ok: false, code: "KIND_TAKEN", name: bucket.name };

    const zoneDepartment = kind === "NATIONAL" ? null : (department ?? null);
    try {
      const zone = await db.shippingZone.create({
        data: {
          name,
          kind,
          department: zoneDepartment,
          priceCents,
          note,
          isActive,
          areas: {
            create: areas.map((area) => ({
              label: area.label,
              matchKey: area.matchKey,
              department: zoneDepartment!,
            })),
          },
        },
        select: { id: true },
      });
      revalidateZones();
      return { ok: true, zoneId: zone.id };
    } catch (error) {
      if (isUniqueViolation(error) && zoneDepartment) {
        return {
          ok: false,
          code: "AREA_TAKEN",
          areas: await takenAreas(
            zoneDepartment,
            areas.map((a) => a.matchKey),
          ),
        };
      }
      throw error;
    }
  });

export const updateShippingZone = actionClient
  .inputSchema(updateShippingZoneSchema)
  .action(async ({ parsedInput }): Promise<ShippingZoneResult> => {
    await requireStaff();
    const {
      zoneId,
      name,
      kind,
      department,
      priceCents,
      note,
      areas,
      isActive,
    } = parsedInput;

    const bucket = await conflictingBucket(kind, department, zoneId);
    if (bucket) return { ok: false, code: "KIND_TAKEN", name: bucket.name };

    const zoneDepartment = kind === "NATIONAL" ? null : (department ?? null);
    try {
      // Areas are replaced wholesale, which is what keeps the department
      // copied onto each row in sync with the zone's own: changing the
      // department rewrites every row rather than leaving stale ones behind.
      await db.$transaction(async (tx) => {
        await tx.shippingZone.update({
          where: { id: zoneId },
          data: {
            name,
            kind,
            department: zoneDepartment,
            priceCents,
            note,
            isActive,
          },
        });
        await tx.shippingZoneArea.deleteMany({ where: { zoneId } });
        if (areas.length > 0) {
          await tx.shippingZoneArea.createMany({
            data: areas.map((area) => ({
              zoneId,
              label: area.label,
              matchKey: area.matchKey,
              department: zoneDepartment!,
            })),
          });
        }
      });
      revalidateZones();
      return { ok: true, zoneId };
    } catch (error) {
      if (isUniqueViolation(error) && zoneDepartment) {
        return {
          ok: false,
          code: "AREA_TAKEN",
          areas: await takenAreas(
            zoneDepartment,
            areas.map((a) => a.matchKey),
            zoneId,
          ),
        };
      }
      throw error;
    }
  });

export const setShippingZoneActive = actionClient
  .inputSchema(setShippingZoneActiveSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    await db.shippingZone.update({
      where: { id: parsedInput.zoneId },
      data: { isActive: parsedInput.isActive },
    });
    revalidateZones();
    return { ok: true as const };
  });

/**
 * Zones carry no history — an order snapshots the name and the cents it was
 * charged (Order.shippingZoneName), so deleting one never rewrites a past
 * order. That is why this is a real delete and not an archive.
 */
export const deleteShippingZone = actionClient
  .inputSchema(deleteShippingZoneSchema)
  .action(async ({ parsedInput }) => {
    await requireStaff();
    await db.shippingZone.delete({ where: { id: parsedInput.zoneId } });
    revalidateZones();
    return { ok: true as const };
  });
