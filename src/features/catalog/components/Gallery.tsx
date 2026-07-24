import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import type { MediaDTO } from "../dto";

// Galería del producto: imagen principal 4:5 con radius 6px. Fase 0 no tiene
// fotografía real, así que rinde el placeholder de rayas; la ruta de media
// queda estructuralmente lista para Cloudinary (imágenes y video en un reel
// ordenado). Video es tap-to-play con controles nativos, nunca autoplay.
export function Gallery({
  media,
  name,
}: {
  media: MediaDTO[];
  name: string;
}) {
  if (media.length === 0) {
    return <ProductImagePlaceholder name={name} />;
  }
  return (
    <div className="scroll-row -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
      {media.map((item) => (
        <div key={item.id} className="w-full shrink-0 snap-center">
          {item.type === "VIDEO" ? (
            <video
              className="aspect-[4/5] w-full rounded-lg bg-arena object-cover"
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
              className="aspect-[4/5] w-full rounded-lg bg-arena object-cover"
              src={item.url}
              alt={item.alt}
            />
          )}
        </div>
      ))}
    </div>
  );
}
