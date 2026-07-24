import { create } from "zustand";
import { persist } from "zustand/middleware";

// La bolsa vive en el cliente (localStorage) hasta que el checkout cree
// órdenes reales. Cada línea guarda un snapshot de presentación (nombre,
// kicker, precio) — la misma filosofía que OrderItem: el carrito no se
// resuelve contra el catálogo vivo en cada render.
export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  // "Categoría · Marca" for the item card kicker.
  kicker: string | null;
  // Chosen option values, e.g. "M · Negro". Null for single-variant products.
  variantLabel: string | null;
  priceCents: number;
  qty: number;
};

// Tarifa plana de envío del handoff ($12.000). Minor units, like all money.
export const SHIPPING_CENTS = 12_000_00;

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.variantId === item.variantId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, qty: i.qty + qty } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, qty }] };
        }),
      setQty: (variantId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) =>
                  i.variantId === variantId ? { ...i, qty } : i,
                ),
        })),
      remove: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "secreto-bolsa",
      // Rehydration is deferred to CartHydration (an effect) so the first
      // client render matches SSR and hydration never mismatches.
      skipHydration: true,
    },
  ),
);

export const countItems = (items: CartItem[]) =>
  items.reduce((n, i) => n + i.qty, 0);

export const subtotalCents = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);
