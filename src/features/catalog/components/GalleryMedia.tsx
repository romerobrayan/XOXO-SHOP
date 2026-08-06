import type { MediaDTO } from "../dto";

// One gallery item — shared by the server-rendered single-image path and the
// client reel, so it must stay hook-free. Video is tap-to-play with native
// controls, never autoplay; the poster keeps the reel from flashing black.
export function GalleryMedia({ item }: { item: MediaDTO }) {
  if (item.type === "VIDEO") {
    return (
      <video
        className="aspect-[4/5] w-full rounded-lg bg-arena object-cover"
        src={item.url}
        poster={item.posterUrl ?? undefined}
        controls
        muted
        playsInline
        preload="none"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivers pre-sized assets
    <img
      className="aspect-[4/5] w-full rounded-lg bg-arena object-contain object-center"
      src={item.url}
      alt={item.alt}
    />
  );
}
