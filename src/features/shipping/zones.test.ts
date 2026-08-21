import { describe, expect, it } from "vitest";

import { areasFromText } from "./schemas";
import {
  cheapestZone,
  FALLBACK_SHIPPING_CENTS,
  hasNationalZone,
  normalizeArea,
  resolveShipping,
  WHATSAPP_ZONE_ID,
  zonesForDepartment,
  type ShippingZoneDTO,
} from "./zones";

const zone = (
  over: Partial<ShippingZoneDTO> & Pick<ShippingZoneDTO, "id" | "kind">,
): ShippingZoneDTO => ({
  name: over.id,
  department: over.kind === "NATIONAL" ? null : "Antioquia",
  priceCents: 10_000_00,
  note: null,
  areas: [],
  areaKeys: [],
  ...over,
});

const withAreas = (
  over: Partial<ShippingZoneDTO> & Pick<ShippingZoneDTO, "id">,
  labels: string[],
) =>
  zone({
    kind: "SPECIFIC",
    areas: labels,
    areaKeys: labels.map(normalizeArea),
    ...over,
  });

const poblado = withAreas({ id: "poblado", priceCents: 8_000_00 }, [
  "El Poblado",
  "Laureles",
]);
const oriente = withAreas({ id: "oriente", priceCents: 15_000_00 }, [
  "Rionegro",
  "La Ceja",
]);
const metro = zone({ id: "metro", kind: "GENERAL", priceCents: 12_000_00 });
const nacional = zone({
  id: "nacional",
  kind: "NATIONAL",
  priceCents: 20_000_00,
});
const ZONES = [poblado, oriente, metro, nacional];

const medellin = { department: "Antioquia", ciudad: "Medellín" };

describe("normalizeArea", () => {
  it("folds case, accents and punctuation", () => {
    expect(normalizeArea("  BELLO  ")).toBe("bello");
    expect(normalizeArea("Niquía")).toBe("niquia");
    expect(normalizeArea("San Antonio de Prado")).toBe("san antonio prado");
  });

  it("makes the articles people drop irrelevant", () => {
    expect(normalizeArea("El Poblado")).toBe(normalizeArea("poblado"));
    expect(normalizeArea("Barrio Manrique")).toBe(normalizeArea("Manrique"));
    expect(normalizeArea("La Estrella")).toBe(normalizeArea("estrella"));
  });

  it("returns empty for input that carries no location", () => {
    expect(normalizeArea("   ")).toBe("");
    expect(normalizeArea("el de la")).toBe("");
  });
});

describe("resolveShipping", () => {
  it("charges the specific zone when the city matches", () => {
    const quote = resolveShipping(ZONES, {
      ...medellin,
      barrio: "el poblado",
    });
    expect(quote).toMatchObject({
      status: "QUOTED",
      zoneId: "poblado",
      priceCents: 8_000_00,
      source: "AUTO",
    });
  });

  it("matches on the city too, not only the neighborhood", () => {
    const quote = resolveShipping(ZONES, {
      department: "Antioquia",
      ciudad: "RIONEGRO",
    });
    expect(quote).toMatchObject({ zoneId: "oriente", source: "AUTO" });
  });

  it("falls back to the department's general fee", () => {
    const quote = resolveShipping(ZONES, {
      ...medellin,
      barrio: "Buenos Aires",
    });
    expect(quote).toMatchObject({
      zoneId: "metro",
      priceCents: 12_000_00,
      source: "FALLBACK",
    });
  });

  it("falls back to the national fee outside the covered departments", () => {
    const quote = resolveShipping(ZONES, {
      department: "Atlántico",
      ciudad: "Barranquilla",
    });
    expect(quote).toMatchObject({ zoneId: "nacional", source: "FALLBACK" });
  });

  it("honors an explicit pick over the automatic match", () => {
    const quote = resolveShipping(ZONES, {
      ...medellin,
      barrio: "El Poblado",
      zoneId: "metro",
    });
    expect(quote).toMatchObject({ zoneId: "metro", source: "SELECTED" });
  });

  it("refuses a zone that is not offered for the declared department", () => {
    // The tampering case: a Barranquilla address asking for the $8.000
    // Medellín fee. The pick is dropped, the ladder decides.
    const quote = resolveShipping(ZONES, {
      department: "Atlántico",
      ciudad: "Barranquilla",
      zoneId: "poblado",
    });
    expect(quote).toMatchObject({ zoneId: "nacional", source: "FALLBACK" });
  });

  it("leaves the fee open when the buyer asks to coordinate on WhatsApp", () => {
    const quote = resolveShipping(ZONES, {
      ...medellin,
      zoneId: WHATSAPP_ZONE_ID,
    });
    expect(quote).toEqual({ status: "UNQUOTED", reason: "WHATSAPP" });
  });

  it("leaves the fee open when nothing covers the address", () => {
    const quote = resolveShipping([poblado], {
      department: "Vaupés",
      ciudad: "Mitú",
    });
    expect(quote).toEqual({ status: "UNQUOTED", reason: "NO_ZONES" });
  });

  it("quotes the pre-zones flat fee while no zone is configured", () => {
    const quote = resolveShipping([], { department: "Vaupés", ciudad: "Mitú" });
    expect(quote).toMatchObject({
      status: "QUOTED",
      priceCents: FALLBACK_SHIPPING_CENTS,
    });
  });

  it("ignores an inactive zone the caller filtered out", () => {
    const quote = resolveShipping([metro, nacional], {
      ...medellin,
      barrio: "El Poblado",
    });
    expect(quote).toMatchObject({ zoneId: "metro" });
  });
});

describe("zonesForDepartment", () => {
  it("offers specific, then general, then national", () => {
    expect(zonesForDepartment(ZONES, "Antioquia").map((z) => z.id)).toEqual([
      "poblado",
      "oriente",
      "metro",
      "nacional",
    ]);
  });

  it("hides another department's zones", () => {
    expect(zonesForDepartment(ZONES, "Atlántico").map((z) => z.id)).toEqual([
      "nacional",
    ]);
  });
});

describe("hasNationalZone / cheapestZone", () => {
  it("flags a configuration that covers nowhere else", () => {
    expect(hasNationalZone([poblado, metro])).toBe(false);
    expect(hasNationalZone(ZONES)).toBe(true);
    // An empty table is the flat national fee, not a hole.
    expect(hasNationalZone([])).toBe(true);
  });

  it("reports the lowest fee for the policy page", () => {
    expect(cheapestZone(ZONES).id).toBe("poblado");
  });
});

describe("areasFromText", () => {
  it("splits on commas and newlines, keeping what the client typed", () => {
    const areas = areasFromText.parse("El Poblado, Laureles\nEnvigado");
    expect(areas).toEqual([
      { label: "El Poblado", matchKey: "poblado" },
      { label: "Laureles", matchKey: "laureles" },
      { label: "Envigado", matchKey: "envigado" },
    ]);
  });

  it("drops blanks and collapses duplicates that normalize the same", () => {
    const areas = areasFromText.parse("El Poblado, , poblado,\nPOBLADO");
    expect(areas).toEqual([{ label: "El Poblado", matchKey: "poblado" }]);
  });

  it("what the client types is what the checkout matches", () => {
    const [area] = areasFromText.parse("  Santa   Mónica ");
    expect(area.label).toBe("Santa Mónica");
    expect(normalizeArea("santa monica")).toBe(area.matchKey);
  });
});
