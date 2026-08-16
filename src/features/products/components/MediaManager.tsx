"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  moveProductMedia,
  removeProductMedia,
  uploadProductMedia,
} from "../actions";
import { imageFileProblem } from "../schemas";

type MediaItem = {
  id: string;
  url: string;
  alt: string;
  position: number;
  type: "IMAGE" | "VIDEO";
  posterUrl: string | null;
};

const UPLOAD_ERROR: Record<string, string> = {
  NOT_FOUND: "el producto ya no existe",
  ALREADY_IN_PRODUCT: "esa foto ya está en el producto",
  LIMIT_REACHED: "máximo 12 fotos por producto",
};

// The owner curates from her phone: the file input with accept="image/*"
// opens the camera-or-gallery chooser on iOS and Android, and a plain picker
// on desktop. Files travel one by one — each under the Server Action body
// limit — and the reel refreshes as each lands.
export function MediaManager({
  productId,
  media,
}: {
  productId: string;
  media: MediaItem[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const busy = progress !== null;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const failed: string[] = [];
    setErrors([]);

    for (const [i, file] of list.entries()) {
      setProgress(
        list.length === 1 ? "Subiendo la foto…" : `Subiendo ${i + 1} de ${list.length}…`,
      );
      // Same checks the schema runs, said in words before the bytes travel.
      const problem = imageFileProblem(file);
      if (problem) {
        failed.push(`${file.name}: ${problem.toLowerCase()}`);
        continue;
      }
      const formData = new FormData();
      formData.set("productId", productId);
      formData.set("file", file);
      try {
        const result = await uploadProductMedia(formData);
        const data = result?.data;
        if (!data) {
          failed.push(`${file.name}: ${result?.serverError ?? "no se pudo subir"}`);
        } else if (!data.ok) {
          failed.push(`${file.name}: ${UPLOAD_ERROR[data.code] ?? "no se pudo subir"}`);
        } else {
          router.refresh();
        }
      } catch {
        failed.push(`${file.name}: no se pudo subir`);
      }
    }

    setProgress(null);
    setErrors(failed);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function move(mediaId: string, direction: "up" | "down") {
    setRowBusy(mediaId);
    try {
      await moveProductMedia({ productId, mediaId, direction });
      router.refresh();
    } finally {
      setRowBusy(null);
    }
  }

  async function remove(mediaId: string) {
    if (confirmRemove !== mediaId) {
      setConfirmRemove(mediaId);
      return;
    }
    setConfirmRemove(null);
    setRowBusy(mediaId);
    try {
      await removeProductMedia({ productId, mediaId });
      router.refresh();
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      {media.length === 0 ? (
        <p className="text-sm font-light text-suave">
          Sin fotos todavía — la tienda muestra el marcador de imagen pendiente.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.map((item, index) => (
            <li key={item.id} className="grid content-start gap-2">
              <div className="relative overflow-hidden rounded-[6px] border border-linea bg-arena">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.type === "VIDEO" ? (item.posterUrl ?? item.url) : item.url}
                  alt={item.alt}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute top-2 left-2">
                    <Badge variant="oro">Portada</Badge>
                  </span>
                ) : null}
                {item.type === "VIDEO" ? (
                  <span className="absolute right-2 bottom-2">
                    <Badge>Video</Badge>
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Mover antes"
                    disabled={index === 0 || rowBusy !== null}
                    onClick={() => move(item.id, "up")}
                  >
                    ←
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Mover después"
                    disabled={index === media.length - 1 || rowBusy !== null}
                    onClick={() => move(item.id, "down")}
                  >
                    →
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={rowBusy !== null}
                  onClick={() => remove(item.id)}
                  onBlur={() =>
                    setConfirmRemove((c) => (c === item.id ? null : c))
                  }
                  className={confirmRemove === item.id ? "text-error" : undefined}
                >
                  {confirmRemove === item.id ? "¿Quitar?" : "Quitar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 border-t border-linea pt-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (progress ?? "Subiendo…") : "Agregar fotos"}
          </Button>
          {busy ? (
            <span role="status" className="text-sm font-light text-suave">
              {progress}
            </span>
          ) : null}
        </div>
        <p className="text-[13px] font-light text-tenue">
          La primera foto es la portada en la tienda. Desde el celular sirve la
          cámara o la galería; JPG, PNG, WEBP o HEIC, máximo 10 MB por foto.
        </p>
      </div>

      {errors.length > 0 ? (
        <ul role="alert" className="grid gap-1">
          {errors.map((message) => (
            <li key={message} className="text-sm text-error">
              {message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
