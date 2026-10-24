"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { cn } from "@/lib/utils";

/**
 * The property's photo gallery. The grid shows the first five; the pill and
 * the "+N" tile open a lightbox over the FULL set, so every photo an admin or
 * hotel manager uploaded is reachable — the grid used to be the whole story
 * and anything past the fifth image was invisible to customers.
 */
export function HotelGallery({
  images,
  hotelId,
  hotelName,
}: {
  images: string[];
  hotelId: string;
  hotelName: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const total = images.length;

  const step = useCallback(
    (delta: number) => setOpenAt((i) => (i === null ? null : (i + delta + total) % total)),
    [total]
  );

  useEffect(() => {
    if (openAt === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAt, step]);

  if (total === 0) {
    return <MediaPlaceholder seed={hotelId} icon={Building2} className="h-56 w-full rounded-2xl sm:h-72" />;
  }

  const tile =
    "group relative overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none";
  const photo = "size-full object-cover transition-transform duration-500 group-hover:scale-105";
  const thumbs = images.slice(1, 5);
  const hidden = total - 1 - thumbs.length;

  return (
    <>
      <div className="relative grid h-64 grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:h-96">
        <button
          type="button"
          onClick={() => setOpenAt(0)}
          aria-label={`${hotelName} — open photo 1 of ${total}`}
          className={cn(tile, "col-span-4 row-span-2 sm:col-span-2")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, host not allow-listed for next/image */}
          <img src={images[0]} alt={hotelName} fetchPriority="high" className={photo} />
        </button>

        {thumbs.map((src, i) => {
          const last = i === thumbs.length - 1 && hidden > 0;
          return (
            <button
              key={src}
              type="button"
              onClick={() => setOpenAt(i + 1)}
              aria-label={`${hotelName} — open photo ${i + 2} of ${total}`}
              className={cn(tile, "hidden sm:block")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, host not allow-listed for next/image */}
              <img src={src} alt={`${hotelName} photo ${i + 2}`} loading="lazy" decoding="async" className={photo} />
              {last ? (
                <span className="absolute inset-0 grid place-items-center bg-black/55 font-heading text-lg font-bold text-white backdrop-blur-[1px]">
                  +{hidden}
                </span>
              ) : null}
            </button>
          );
        })}

        {thumbs.length < 4
          ? Array.from({ length: 4 - thumbs.length }).map((_, i) => (
              <MediaPlaceholder
                key={i}
                seed={`${hotelId}-${i}`}
                icon={Building2}
                className="hidden size-full sm:block"
              />
            ))
          : null}

        <button
          type="button"
          onClick={() => setOpenAt(0)}
          className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/65 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <Images className="size-4" aria-hidden />
          {total} photo{total === 1 ? "" : "s"}
        </button>
      </div>

      <Dialog open={openAt !== null} onOpenChange={(open) => setOpenAt(open ? (openAt ?? 0) : null)}>
        <DialogContent
          showCloseButton
          className="max-h-[92vh] max-w-[min(1100px,calc(100%-2rem))] gap-3 bg-background p-3 sm:max-w-[min(1100px,calc(100%-2rem))]"
        >
          <DialogTitle className="sr-only">{hotelName} photos</DialogTitle>

          <div className="relative flex h-[50vh] items-center justify-center overflow-hidden rounded-lg bg-black sm:h-[60vh]">
            {openAt !== null ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, host not allow-listed for next/image
              <img
                src={images[openAt]}
                alt={`${hotelName} photo ${openAt + 1} of ${total}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : null}

            {total > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                  className="absolute left-3 grid size-10 place-items-center rounded-full bg-white/90 text-foreground shadow-md transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                  className="absolute right-3 grid size-10 place-items-center rounded-full bg-white/90 text-foreground shadow-md transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white tabular-nums">
                  {(openAt ?? 0) + 1} / {total}
                </span>
              </>
            ) : null}
          </div>

          {total > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setOpenAt(i)}
                  aria-label={`Photo ${i + 1}`}
                  aria-current={i === openAt ? "true" : undefined}
                  className={cn(
                    "h-14 w-20 shrink-0 overflow-hidden rounded-md ring-2 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    i === openAt ? "ring-primary" : "ring-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, host not allow-listed for next/image */}
                  <img src={src} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
