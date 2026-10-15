"use client";

import { Label } from "@/components/ui/label";
import { FileField } from "@/components/ui/upload";

/**
 * File picker for a new room's required photos, submitted with the room
 * form itself. Once the room exists, GalleryManager (which needs a real row
 * id to upload against) takes over for adding/removing/reordering photos.
 */
export function RoomPhotosField({ id, name = "photos" }: { id: string; name?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        Room photos <span className="text-destructive">*</span>
      </Label>
      <FileField id={id} name={name} accept="image/jpeg,image/png,image/webp" multiple required label="Drop room photos" />
    </div>
  );
}
