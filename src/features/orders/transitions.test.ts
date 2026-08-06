import { describe, expect, it } from "vitest";

import { OrderStatus } from "@/generated/prisma/enums";
import { findTransition, STATUS_LABEL, transitionsFrom } from "./transitions";

const ALL = Object.values(OrderStatus);

describe("order status transitions", () => {
  it("labels every status, so the panel never renders a raw enum", () => {
    for (const status of ALL) {
      expect(STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("declares an entry for every status, including the terminal ones", () => {
    for (const status of ALL) {
      expect(Array.isArray(transitionsFrom(status))).toBe(true);
    }
  });

  it("closes CANCELLED and REFUNDED", () => {
    expect(transitionsFrom("CANCELLED")).toHaveLength(0);
    expect(transitionsFrom("REFUNDED")).toHaveLength(0);
  });

  it("never lets a status transition to itself", () => {
    for (const status of ALL) {
      expect(transitionsFrom(status).map((t) => t.to)).not.toContain(status);
    }
  });

  it("offers each target at most once per source", () => {
    for (const status of ALL) {
      const targets = transitionsFrom(status).map((t) => t.to);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  // The ledger invariants this whole machine exists to protect.
  it("releases reserved stock exactly on the paths that cancel", () => {
    for (const status of ALL) {
      for (const t of transitionsFrom(status)) {
        if (t.to === "CANCELLED") expect(t.effect).toBe("release");
      }
    }
  });

  it("consumes the reservation only when shipping", () => {
    const commits = ALL.flatMap((s) =>
      transitionsFrom(s)
        .filter((t) => t.effect === "commit")
        .map((t) => ({ from: s, to: t.to })),
    );
    expect(commits).toEqual([{ from: "PROCESSING", to: "SHIPPED" }]);
  });

  it("returns stock only on a refund", () => {
    for (const status of ALL) {
      for (const t of transitionsFrom(status)) {
        if (t.effect === "return") expect(t.to).toBe("REFUNDED");
        if (t.to === "REFUNDED") expect(t.effect).toBe("return");
      }
    }
  });

  // Shipping is what turns a reservation into a sale. Reaching SHIPPED from a
  // status that never reserved, or skipping PROCESSING, would commit stock
  // that was never held.
  it("only reaches SHIPPED from PROCESSING", () => {
    const sources = ALL.filter((s) =>
      transitionsFrom(s).some((t) => t.to === "SHIPPED"),
    );
    expect(sources).toEqual(["PROCESSING"]);
  });

  it("cannot refund an order that never shipped", () => {
    expect(findTransition("PENDING", "REFUNDED")).toBeUndefined();
    expect(findTransition("PAID", "REFUNDED")).toBeUndefined();
    expect(findTransition("PROCESSING", "REFUNDED")).toBeUndefined();
  });

  it("rejects unknown pairs", () => {
    expect(findTransition("DELIVERED", "PENDING")).toBeUndefined();
    expect(findTransition("CANCELLED", "PAID")).toBeUndefined();
  });

  it("warns before every move that changes stock", () => {
    for (const status of ALL) {
      for (const t of transitionsFrom(status)) {
        if (t.effect !== "none") expect(t.confirm).toBeTruthy();
      }
    }
  });
});
