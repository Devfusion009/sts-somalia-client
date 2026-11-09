"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import styles from "./premium-travel.module.css";

export type UmrahGalleryPhoto = { src: string; title: string; detail: string; alt: string };

export function UmrahPhotoGallery({ photos, kind, label }: { photos: UmrahGalleryPhoto[]; kind: "transport" | "hotels"; label: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected === null ? null : photos[selected];
  function move(direction: number) {
    setSelected((current) => current === null ? null : (current + direction + photos.length) % photos.length);
  }

  return (
    <>
      <div className={kind === "hotels" ? styles.hotelGrid : styles.serviceGrid} aria-label={label}>
        {photos.map((photo, index) => <button key={photo.src} type="button" onClick={() => setSelected(index)} aria-label={`View photo: ${photo.title}`} className={styles.servicePhoto}>
          <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 45vw" />
          <span className={styles.servicePhotoLabel}><span><strong>{photo.title}</strong><small>{photo.detail}</small></span><span className={styles.zoomIcon}><ZoomIn className="size-3.5" aria-hidden="true" /></span></span>
        </button>)}
        {kind === "hotels" && <div className={styles.hotelDetails}><span>Room to rest.<br />Time for worship.</span><ul>{["Twin, triple & quad rooms", "Air conditioning", "24-hour reception", "Makkah & Madinah"].map((item) => <li key={item}><Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />{item}</li>)}</ul></div>}
      </div>
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-4xl" aria-describedby={undefined} onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
        }}>
          {active && <>
            <div className="relative aspect-[4/3] max-h-[65vh] bg-[#102f2b] sm:aspect-video"><Image src={active.src} alt={active.alt} fill sizes="(max-width: 768px) 100vw, 896px" className="object-contain" /></div>
            <div className="flex items-center justify-between gap-4 bg-card p-5">
              <div aria-live="polite" aria-atomic="true"><DialogTitle className="leading-snug">{active.title}</DialogTitle><span className="mt-1 block text-xs text-muted-foreground">STS Umrah collection · {(selected ?? 0) + 1} / {photos.length}</span></div>
              <div className="flex gap-2"><button type="button" onClick={() => move(-1)} aria-label="Previous photo" className="grid size-11 place-items-center rounded-full border border-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft className="size-4" aria-hidden="true" /></button><button type="button" onClick={() => move(1)} aria-label="Next photo" className="grid size-11 place-items-center rounded-full border border-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"><ArrowRight className="size-4" aria-hidden="true" /></button></div>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
