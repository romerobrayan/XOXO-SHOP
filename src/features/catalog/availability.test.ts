import { describe, expect, it } from "vitest";

import {
  availabilityLabel,
  availableOf,
  bandFor,
} from "./availability";

describe("availableOf", () => {
  it("is stockOnHand minus stockReserved", () => {
    expect(availableOf({ stockOnHand: 6, stockReserved: 0 })).toBe(6);
  });

  // The storefront number must diverge from raw stock as soon as reservations
  // exist — binding stockOnHand directly is the bug this test guards against.
  it("subtracts reserved stock", () => {
    expect(availableOf({ stockOnHand: 6, stockReserved: 4 })).toBe(2);
  });

  it("never goes negative", () => {
    expect(availableOf({ stockOnHand: 1, stockReserved: 3 })).toBe(0);
  });
});

describe("bandFor", () => {
  it("is out at zero", () => {
    expect(bandFor(0, 3)).toEqual({ state: "out" });
  });

  it("is low from one up to the threshold", () => {
    expect(bandFor(1, 3)).toEqual({ state: "low", units: 1 });
    expect(bandFor(3, 3)).toEqual({ state: "low", units: 3 });
  });

  it("is plainly available above the threshold", () => {
    expect(bandFor(4, 3)).toEqual({ state: "available" });
  });
});

describe("availabilityLabel", () => {
  it("pluralizes es-CO copy", () => {
    expect(availabilityLabel({ state: "available" })).toBe("Disponible");
    expect(availabilityLabel({ state: "low", units: 1 })).toBe("Queda 1 unidad");
    expect(availabilityLabel({ state: "low", units: 2 })).toBe(
      "Quedan 2 unidades",
    );
    expect(availabilityLabel({ state: "out" })).toBe("Agotado");
  });
});
