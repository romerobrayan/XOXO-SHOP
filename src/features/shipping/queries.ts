import "server-only";

import { FALLBACK_ZONE, type ShippingZoneDTO } from "./zones";

// Read paths for delivery zones. Like the catalog queries, `@/lib/db` is
// imported dynamically inside the live branch only: the module builds the
// Prisma client at load time and must never load during a database-less
// build or preview render.
const noDatabase = () => !process.env.DATABASE_URL;
const loadDb = async () => (await import("@/lib/db")).db;

// Specific zones first, then the general fee, then national — the same order
// the checkout offers and the policy page publishes.
const KIND_ORDER = { SPECIFIC: 0, GENERAL: 1, NATIONAL: 2 } as const;

type ZoneRow = {
  id: string;
  name: string;
  kind: keyof typeof KIND_ORDER;
  department: string | null;
  priceCents: number;
  note: string | null;
  areas: { label: string; matchKey: string }[];
};

function toDTO(zone: ZoneRow): ShippingZoneDTO {
  return {
    id: zone.id,
    name: zone.name,
    kind: zone.kind,
    department: zone.department,
    priceCents: zone.priceCents,
    note: zone.note,
    areas: zone.areas.map((a) => a.label),
    areaKeys: zone.areas.map((a) => a.matchKey),
  };
}

const sortZones = (a: ShippingZoneDTO, b: ShippingZoneDTO) =>
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
  (a.department ?? "").localeCompare(b.department ?? "", "es") ||
  a.priceCents - b.priceCents ||
  a.name.localeCompare(b.name, "es");

const zoneSelect = {
  id: true,
  name: true,
  kind: true,
  department: true,
  priceCents: true,
  note: true,
  areas: { select: { label: true, matchKey: true }, orderBy: { label: "asc" } },
} as const;

/**
 * What the storefront charges: active zones only. An empty table answers with
 * the flat fallback fee so a store that has not configured zones yet keeps
 * quoting exactly what it quoted before they existed.
 */
export async function getShippingZones(): Promise<ShippingZoneDTO[]> {
  if (noDatabase()) return [FALLBACK_ZONE];
  const db = await loadDb();
  const zones = await db.shippingZone.findMany({
    where: { isActive: true },
    select: zoneSelect,
  });
  if (zones.length === 0) return [FALLBACK_ZONE];
  return zones.map(toDTO).sort(sortZones);
}

export type AdminShippingZone = ShippingZoneDTO & { isActive: boolean };

/**
 * What the panel edits: every zone, active or not, and never the fallback —
 * the client must see an empty list as empty, so the missing-national-zone
 * warning is about what they actually configured.
 */
export async function getAllShippingZones(): Promise<AdminShippingZone[]> {
  if (noDatabase()) return [];
  const db = await loadDb();
  const zones = await db.shippingZone.findMany({
    select: { ...zoneSelect, isActive: true },
  });
  return zones
    .map((zone) => ({ ...toDTO(zone), isActive: zone.isActive }))
    .sort(sortZones);
}

export async function getShippingZone(
  id: string,
): Promise<AdminShippingZone | null> {
  if (noDatabase()) return null;
  const db = await loadDb();
  const zone = await db.shippingZone.findUnique({
    where: { id },
    select: { ...zoneSelect, isActive: true },
  });
  return zone ? { ...toDTO(zone), isActive: zone.isActive } : null;
}
