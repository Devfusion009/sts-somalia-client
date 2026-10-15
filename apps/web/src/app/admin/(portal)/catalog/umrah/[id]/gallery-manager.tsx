"use client";

import { GalleryManager as SharedGalleryManager } from "@/components/admin/gallery-manager";
import { uploadUmrahImages, removeUmrahImage, setUmrahCoverImage } from "@/modules/umrah/admin-actions";

/** Umrah packages use the shared gallery: images only, 5 MB each, keyed by packageId. */
export function GalleryManager({ packageId, paths }: { packageId: string; paths: string[] }) {
  return (
    <SharedGalleryManager
      id={packageId}
      idField="packageId"
      paths={paths}
      bucket="umrah-images"
      imagesOnly
      maxBytes={5 * 1024 * 1024}
      uploadAction={uploadUmrahImages}
      removeAction={removeUmrahImage}
      setCoverAction={setUmrahCoverImage}
    />
  );
}
