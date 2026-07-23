import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import type { MediaDTO } from "../dto";

// Product gallery. Phase 0 has no real photography, so this renders the
// honest placeholder; the media path below is structurally ready for when
// Cloudinary assets exist (images and video in one ordered reel — see
// ProductMedia in the schema). Video is poster + tap-to-play with native
// controls, muted by default, never autoplay: the audience arrives on mobile
// data, and autoplay also fights prefers-reduced-motion.
export function Gallery({ media, name, seed }: { media: MediaDTO[]; name: string; seed: string }) {
  if (media.length === 0) {
    return <ProductImagePlaceholder name={name} seed={seed} />;
  }
  return (
    <div className="scroll-row -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
      {media.map((item) => (
        <div key={item.id} className="w-full shrink-0 snap-center">
          {item.type === "VIDEO" ? (
            <video
              className="aspect-[4/5] w-full rounded-xl bg-surface object-cover"
              src={item.url}
              poster={item.posterUrl ?? undefined}
              controls
              muted
              playsInline
              preload="none"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivers pre-sized assets
            <img
              className="aspect-[4/5] w-full rounded-xl bg-surface object-cover"
              src={item.url}
              alt={item.alt}
            />
          )}
        </div>
      ))}
    </div>
  );
}
