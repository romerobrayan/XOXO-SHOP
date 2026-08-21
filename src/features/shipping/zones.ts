// Domicilio por zona: qué cobra el checkout según a dónde va el pedido.
//
// Pure module on purpose — no Prisma, no server-only, no React. The admin
// panel writes zones, the storefront reads them, the shipping policy page
// publishes them and the order action prices against them, and all four go
// through the functions here so the published price, the price on screen and
// the price charged cannot diverge.

/** Mirrors enum ShippingZoneKind in prisma/schema.prisma. */
export type ShippingZoneKind = "SPECIFIC" | "GENERAL" | "NATIONAL";

export type ShippingZoneDTO = {
  id: string;
  name: string;
  kind: ShippingZoneKind;
  /** Set for SPECIFIC and GENERAL, null for NATIONAL. */
  department: string | null;
  priceCents: number;
  note: string | null;
  /** What the client typed, for display: ["El Poblado", "Laureles"]. */
  areas: string[];
  /** The same list normalized, for matching. Parallel to `areas`. */
  areaKeys: string[];
};

/**
 * Sentinel the checkout's zone <select> uses for "mi zona no aparece".
 * Not a cuid, so it can never collide with a real zone id.
 */
export const WHATSAPP_ZONE_ID = "whatsapp";

/**
 * The flat fee the store charged before zones existed ($12.000). It survives
 * as the fallback zone below — not as a business rule, but so a database with
 * no zones yet (a fresh install, the database-less preview) keeps behaving
 * exactly as it did instead of dropping every order into WhatsApp.
 */
export const FALLBACK_SHIPPING_CENTS = 12_000_00;

export const FALLBACK_ZONE: ShippingZoneDTO = {
  id: "fallback-nacional",
  name: "Envío nacional",
  kind: "NATIONAL",
  department: null,
  priceCents: FALLBACK_SHIPPING_CENTS,
  note: null,
  areas: [],
  areaKeys: [],
};

/**
 * Both sides of a match go through this, so what matters is that it is
 * consistent, not that it is clever: accents dropped, case folded,
 * punctuation and the articles people leave in or out ("El Poblado" /
 * "Poblado", "Barrio Manrique" / "Manrique") reduced to nothing.
 */
export function normalizeArea(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(barrio|vereda|corregimiento|el|la|los|las|de|del)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const byPriceThenName = (a: ShippingZoneDTO, b: ShippingZoneDTO) =>
  a.priceCents - b.priceCents || a.name.localeCompare(b.name, "es");

const active = (zones: readonly ShippingZoneDTO[]) =>
  zones.length === 0 ? [FALLBACK_ZONE] : zones;

/**
 * The zones a buyer in `department` can actually be charged, in the order the
 * checkout offers them: the specific ones first, then the department's
 * general fee, then the national one. This is also the ladder resolveShipping
 * walks, which is why the select can never show an option the server would
 * refuse to honor.
 */
export function zonesForDepartment(
  zones: readonly ShippingZoneDTO[],
  department: string,
): ShippingZoneDTO[] {
  const all = active(zones);
  return [
    ...all
      .filter((z) => z.kind === "SPECIFIC" && z.department === department)
      .sort(byPriceThenName),
    ...all
      .filter((z) => z.kind === "GENERAL" && z.department === department)
      .sort(byPriceThenName),
    ...all.filter((z) => z.kind === "NATIONAL").sort(byPriceThenName),
  ];
}

export type ShippingQuote =
  | {
      status: "QUOTED";
      zoneId: string;
      zoneName: string;
      priceCents: number;
      note: string | null;
      /**
       * SELECTED — the buyer picked this zone.
       * AUTO — their city or neighborhood matched a specific zone.
       * FALLBACK — no specific zone matched, so the general or national fee.
       */
      source: "SELECTED" | "AUTO" | "FALLBACK";
    }
  | {
      status: "UNQUOTED";
      /**
       * WHATSAPP — the buyer chose to coordinate the fee with an advisor.
       * NO_ZONES — nothing covers this address (no national zone defined).
       */
      reason: "WHATSAPP" | "NO_ZONES";
    };

const quote = (
  zone: ShippingZoneDTO,
  source: "SELECTED" | "AUTO" | "FALLBACK",
): ShippingQuote => ({
  status: "QUOTED",
  zoneId: zone.id,
  zoneName: zone.name,
  priceCents: zone.priceCents,
  note: zone.note,
  source,
});

export type ShippingAddressInput = {
  department: string;
  ciudad: string;
  barrio?: string | null;
  /** The zone the buyer picked, if any. Empty/undefined means "auto". */
  zoneId?: string | null;
};

/**
 * The single answer to "what does this address pay". The server calls it with
 * the same zone list the browser had, and never trusts a price the client
 * sends — only which zone it picked, and only if that zone is on offer for
 * the declared department.
 */
export function resolveShipping(
  zones: readonly ShippingZoneDTO[],
  input: ShippingAddressInput,
): ShippingQuote {
  if (input.zoneId === WHATSAPP_ZONE_ID) {
    return { status: "UNQUOTED", reason: "WHATSAPP" };
  }

  const offered = zonesForDepartment(zones, input.department);

  // An explicit pick wins, but only among what this department is offered:
  // otherwise a tampered payload could buy a Medellín fee for a Leticia
  // address. An unknown id is not an error — it falls through to the ladder.
  if (input.zoneId) {
    const picked = offered.find((z) => z.id === input.zoneId);
    if (picked) return quote(picked, "SELECTED");
  }

  const keys = [input.ciudad, input.barrio ?? ""]
    .map(normalizeArea)
    .filter((key) => key.length > 0);
  const matched = offered.find(
    (z) =>
      z.kind === "SPECIFIC" && z.areaKeys.some((key) => keys.includes(key)),
  );
  if (matched) return quote(matched, "AUTO");

  const fallback = offered.find((z) => z.kind !== "SPECIFIC");
  if (fallback) return quote(fallback, "FALLBACK");

  return { status: "UNQUOTED", reason: "NO_ZONES" };
}

/**
 * True when the configured zones leave buyers outside the covered
 * departments with nowhere to land. The panel warns on it: without a national
 * zone, publishing the first specific zone silently sends the rest of the
 * country to WhatsApp.
 */
export function hasNationalZone(zones: readonly ShippingZoneDTO[]): boolean {
  return active(zones).some((z) => z.kind === "NATIONAL");
}

/** Cheapest configured fee — the "desde" figure the policy page publishes. */
export function cheapestZone(
  zones: readonly ShippingZoneDTO[],
): ShippingZoneDTO {
  return [...active(zones)].sort(byPriceThenName)[0];
}
