"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";
import type { HeroSlide } from "../heroSlides";

// El escaparate del héroe: un marco 4:5 (el del handoff: 368px de ancho,
// radius 6px, campo arena) que rota una foto real por familia con un
// crossfade solo de opacidad. La rotación se pausa con hover y con foco, y
// bajo prefers-reduced-motion no avanza sola — además del guard CSS global.
//
// MOTION AMENDMENT: el intervalo y la duración del crossfade extienden la
// especificación de movimiento del handoff (ver globals.css) — pendiente del
// visto bueno de la clienta junto con la Fase 0.
const ADVANCE_INTERVAL_MS = 5000;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

export function HeroShowcase({
  slides,
  className,
}: {
  slides: HeroSlide[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Same pattern as the age gate: the server snapshot assumes motion is fine
  // (the CSS reduced-motion guard covers first paint) and the client corrects
  // itself before any interval starts.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );

  useEffect(() => {
    if (paused || reducedMotion || slides.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      ADVANCE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [paused, reducedMotion, slides.length]);

  const active = slides[index] ?? slides[0];
  if (!active) return null;

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label="Productos destacados por categoría"
      className={cn("w-full max-w-[368px]", className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Un solo Link por vista: orden de tabulación estable, y el caption
          visible es su nombre accesible — las imágenes van aria-hidden. */}
      <Link href={active.href} className="block">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-arena">
          {slides.map((slide, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivers pre-sized assets
            <img
              key={slide.href}
              src={slide.imageUrl}
              alt=""
              aria-hidden="true"
              loading={i === 0 ? "eager" : "lazy"}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-[var(--motion-crossfade)] ease-out",
                i === index ? "opacity-100" : "opacity-0",
              )}
            />
          ))}
        </div>
        <p className="kicker mt-4 truncate">{active.categoryName}</p>
        <p className="mt-1 truncate font-display text-lg text-tinta">
          {active.productName} →
        </p>
      </Link>
      {slides.length > 1 && (
        <div className="mt-1 flex">
          {slides.map((slide, i) => (
            <button
              key={slide.href}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver ${slide.categoryName}`}
              aria-current={i === index ? "true" : undefined}
              className="flex h-11 w-6 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-150",
                  i === index ? "bg-vino" : "bg-linea",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
