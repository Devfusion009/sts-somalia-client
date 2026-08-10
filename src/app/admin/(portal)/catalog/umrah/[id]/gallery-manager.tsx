"use client";

import { useActionState } from "react";
import { AlertCircle, CloudUpload, ImageIcon, Star, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadUmrahImages, removeUmrahImage, setUmrahCoverImage } from "@/modules/umrah/admin-actions";
import { umrahImageUrl } from "@/modules/umrah/images";

export function GalleryManager({ packageId, paths }: { packageId: string; paths: string[] }) {
  const [state, formAction, pending] = useActionState(uploadUmrahImages, null);

  return (
    <div className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="packageId" value={packageId} />
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-6 text-sm transition-colors ${
            pending
              ? "border-primary/40 bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent"
          }`}
        >
          <input
            type="file"
            name="files"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              if (e.target.files?.length) e.currentTarget.form?.requestSubmit();
            }}
          />
          <CloudUpload className="size-5" />
          {pending ? "Uploading…" : "Click to choose images — uploads automatically"}
          <span className="text-xs">JPG, PNG, or WebP · up to 5MB each · 10 at a time</span>
        </label>
      </form>

      {paths.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border py-10 text-center">
          <ImageIcon className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium">No images yet</p>
          <p className="text-xs text-muted-foreground">
            Customers see a generated placeholder until you add at least one photo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {paths.map((path, i) => (
            <div key={path} className="group relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={umrahImageUrl(path) ?? ""} alt="" className="aspect-4/3 w-full object-cover" />
              {i === 0 ? (
                <Badge className="absolute left-1.5 top-1.5 gap-1 border-transparent bg-primary text-primary-foreground">
                  <Star className="size-3" /> Cover
                </Badge>
              ) : null}
              <div className="flex items-center justify-between gap-1 p-1.5">
                {i === 0 ? (
                  <span className="px-1 text-xs text-muted-foreground">Shown first</span>
                ) : (
                  <form action={setUmrahCoverImage}>
                    <input type="hidden" name="packageId" value={packageId} />
                    <input type="hidden" name="path" value={path} />
                    <Button type="submit" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
                      <Star className="size-3" /> Make cover
                    </Button>
                  </form>
                )}
                <form action={removeUmrahImage}>
                  <input type="hidden" name="packageId" value={packageId} />
                  <input type="hidden" name="path" value={path} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
