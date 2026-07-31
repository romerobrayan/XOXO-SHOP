import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import type { MediaDTO } from "../dto";
import { GalleryMedia } from "./GalleryMedia";
import { GalleryReel } from "./GalleryReel";

// Galería del producto: imagen principal 4:5 con radius 6px sobre arena.
// Sin fotos rinde el placeholder de rayas; con una sola foto no paga JS de
// cliente; con varias, el reel agrega flechas y puntos — antes era un
// scroll-snap sin ninguna señal de que había más imágenes.
export function Gallery({ media, name }: { media: MediaDTO[]; name: string }) {
  if (media.length === 0) {
    return <ProductImagePlaceholder name={name} />;
  }
  if (media.length === 1) {
    return <GalleryMedia item={media[0]} />;
  }
  return <GalleryReel media={media} name={name} />;
}
