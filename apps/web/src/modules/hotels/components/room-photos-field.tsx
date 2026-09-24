"use client";

import { useEffect, useState } from "react";
import { CloudUpload } from "lucide-react";
import { Label } from "@/components/ui/label";

/**
 * File picker for a new room's required photos. Uncontrolled by design: the
 * native <input type="file" multiple required> already holds the FileList
 * the surrounding <form> submits — this only mirrors it into local preview
 * thumbnails so the admin/manager can see what they picked before saving.
 * Once the room exists, GalleryManager (which needs a real row id to upload
 * against) takes over for adding/removing/reordering photos.
 */
export function RoomPhotosField({ id, name = "photos" }: { id: string; name?: string }) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only, not re-run per render
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        Room photos <span className="text-destructive">*</span>
      </Label>
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent"
      >
        <input
          id={id}
          name={name}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          required
          className="sr-only"
          onChange={(e) => {
            previews.forEach((url) => URL.revokeObjectURL(url));
            const files = Array.from(e.target.files ?? []);
            setPreviews(files.map((f) => URL.createObjectURL(f)));
          }}
        />
        <CloudUpload className="size-5" />
        {previews.length > 0 ? `${previews.length} photo${previews.length > 1 ? "s" : ""} selected` : "Click to add photos"}
      </label>

      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a Storage URL
            <img key={url} src={url} alt={`Selected photo ${i + 1}`} className="aspect-4/3 w-full rounded-lg border border-border object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
