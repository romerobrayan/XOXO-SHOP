"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { MediaDTO } from "../dto";
import { GalleryMedia } from "./GalleryMedia";

// Multi-image reel: the native scroll-snap track stays (swipe keeps working
// untouched); arrows and dots add the affordance the bare track never had.
// Controls sit BELOW the image — a 1.5px outline glyph overlaid on arbitrary
// photography fails contrast, and a backing plate would invent a pill.
export function GalleryReel({
  media,
  name,
}: {
  media: MediaDTO[];
  name: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [index, setIndex] = useState(0);

  // Reading the stride from the DOM keeps the 12px gap from ever drifting
  // out of sync with the math.
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const items = track.children;
      const stride =
        items.length > 1
          ? (items[1] as HTMLElement).offsetLeft -
            (items[0] as HTMLElement).offsetLeft
          : track.clientWidth;
      const next = Math.round(track.scrollLeft / stride);
      setIndex(Math.min(Math.max(next, 0), media.length - 1));
    });
  };

  // scrollIntoView honors the snap points; the global reduced-motion rule
  // flips smooth scrolling to auto.
  const goTo = (i: number) => {
    const target = trackRef.current?.children[i] as HTMLElement | undefined;
    target?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label={`Galería de ${name}`}
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="scroll-row -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:px-0"
      >
        {media.map((item) => (
          <div key={item.id} className="w-full shrink-0 snap-center">
            <GalleryMedia item={item} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Imagen anterior"
          className="flex size-11 items-center justify-center text-cuerpo transition-colors hover:text-vino disabled:pointer-events-none disabled:opacity-45"
        >
          <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-5" />
        </button>
        <div className="flex items-center">
          {media.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ir a la imagen ${i + 1} de ${media.length}`}
              aria-current={i === index ? "true" : undefined}
              className="flex h-11 w-5 items-center justify-center"
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
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === media.length - 1}
          aria-label="Imagen siguiente"
          className="flex size-11 items-center justify-center text-cuerpo transition-colors hover:text-vino disabled:pointer-events-none disabled:opacity-45"
        >
          <ChevronRight
            aria-hidden="true"
            strokeWidth={1.5}
            className="size-5"
          />
        </button>
      </div>
    </div>
  );
}
