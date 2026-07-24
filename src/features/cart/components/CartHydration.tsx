"use client";

import { useEffect } from "react";

import { useCart } from "../store";

// Mounted once per layout: pulls the persisted bag into the store after
// hydration. Until it runs, every reader sees the empty SSR state.
export function CartHydration() {
  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);
  return null;
}
