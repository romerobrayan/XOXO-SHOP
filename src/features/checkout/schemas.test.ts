import { describe, expect, it } from "vitest";

import {
  createOrderSchema,
  deliveryDataSchema,
  MAX_QTY_PER_LINE,
} from "./schemas";

const delivery = {
  nombre: "Ana María Restrepo",
  celular: "300 123 4567",
  documentType: "CC",
  documentId: "1023456789",
  department: "Antioquia",
  ciudad: "Medellín",
  direccion: "Calle 10 # 43E-25, apto 301",
};

const input = {
  idempotencyKey: "3f2f1a9c-7b1d-4e5a-9c2b-8d4f6a0e1b2c",
  items: [{ variantId: "var-lov-lush3", qty: 1 }],
  delivery,
  paymentMethod: "CASH_ON_DELIVERY",
};

describe("createOrderSchema", () => {
  it("accepts a contra entrega order without email", () => {
    expect(createOrderSchema.safeParse(input).success).toBe(true);
  });

  it("requires email for online payment, at the email path", () => {
    const result = createOrderSchema.safeParse({
      ...input,
      paymentMethod: "ONLINE",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["delivery", "email"]);
  });

  it("accepts online payment once email is present", () => {
    const result = createOrderSchema.safeParse({
      ...input,
      paymentMethod: "ONLINE",
      delivery: { ...delivery, email: "Ana.Restrepo@Example.com" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.delivery.email).toBe("ana.restrepo@example.com");
  });

  it("strips client-sent prices — the server re-reads them from the database", () => {
    const result = createOrderSchema.safeParse({
      ...input,
      items: [{ variantId: "var-lov-lush3", qty: 1, priceCents: 100 }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.items[0]).toEqual({
      variantId: "var-lov-lush3",
      qty: 1,
    });
  });

  it("rejects duplicate variant lines", () => {
    const result = createOrderSchema.safeParse({
      ...input,
      items: [
        { variantId: "var-lov-lush3", qty: 1 },
        { variantId: "var-lov-lush3", qty: 2 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero, negative, fractional and oversized quantities", () => {
    for (const qty of [0, -1, 1.5, MAX_QTY_PER_LINE + 1]) {
      const result = createOrderSchema.safeParse({
        ...input,
        items: [{ variantId: "var-lov-lush3", qty }],
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects an empty bag and a missing idempotency key", () => {
    expect(createOrderSchema.safeParse({ ...input, items: [] }).success).toBe(
      false,
    );
    expect(
      createOrderSchema.safeParse({ ...input, idempotencyKey: "not-a-uuid" })
        .success,
    ).toBe(false);
  });
});

describe("deliveryDataSchema", () => {
  it("normalizes the phone formats people actually type", () => {
    for (const typed of [
      "3001234567",
      "300 123 4567",
      "300-123-4567",
      "+57 300 123 4567",
      "573001234567",
    ]) {
      const result = deliveryDataSchema.safeParse({
        ...delivery,
        celular: typed,
      });
      expect(result.success).toBe(true);
      expect(result.data?.celular).toBe("3001234567");
    }
  });

  it("rejects landlines, short numbers and foreign prefixes", () => {
    for (const typed of ["6041234567", "300123456", "+1 300 123 4567"]) {
      expect(
        deliveryDataSchema.safeParse({ ...delivery, celular: typed }).success,
      ).toBe(false);
    }
  });

  it("uppercases the document id and rejects garbage", () => {
    const ok = deliveryDataSchema.safeParse({
      ...delivery,
      documentType: "PP",
      documentId: "ab123456",
    });
    expect(ok.data?.documentId).toBe("AB123456");
    expect(
      deliveryDataSchema.safeParse({ ...delivery, documentId: "12" }).success,
    ).toBe(false);
  });

  it("requires a real department, not free text", () => {
    expect(
      deliveryDataSchema.safeParse({ ...delivery, department: "Antioquía " })
        .success,
    ).toBe(false);
  });

  it("turns empty notas into undefined", () => {
    const result = deliveryDataSchema.safeParse({ ...delivery, notas: "  " });
    expect(result.success).toBe(true);
    expect(result.data?.notas).toBeUndefined();
  });
});
