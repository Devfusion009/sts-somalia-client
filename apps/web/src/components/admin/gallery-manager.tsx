"use client";

import { useActionState } from "react";
import { AlertCircle, CloudUpload, ImageIcon, Star, Trash2, Film } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ActionState } from "@/lib/auth/actions";

const VIDEO_EXTENSIONS = [".mp4", ".webm"];

/**
 * Builds the public storage URL inline (rather than accepting a urlFor
 * function prop) because a plain function can't cross the Server → Client
 * Component boundary — only "use server" actions can. hotelImageUrl/
 * venueImageUrl in modules/{hotels,events}/images.ts do the exact same
 * thing; this mirrors their logic for the one property (bucket name) that
 * actually differs between them.
 */
function galleryUrl(bucket: "hotel-images" | "venue-images", path: string): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${bucket}/${path}` : null;
}

/**
 * Generic photo/video gallery editor — same upload/remove/cover shape as
 * modules/umrah's gallery-manager.tsx, generalized over id/paths/bucket/
 * actions so hotels, rooms, and venues share one component instead of three
 * near-identical copies.
 */
export function GalleryManager({
  id,
  paths,
  bucket,
  uploadAction,
  removeAction,
  setCoverAction,
}: {
  id: string;
  paths: string[];
  bucket: "hotel-images" | "venue-images";
  uploadAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  removeAction: (formData: FormData) => Promise<void>;
  setCoverAction: (formData: FormData) => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(uploadAction, null);

  return (
    <div className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
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
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            multiple
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              if (e.target.files?.length) e.currentTarget.form?.requestSubmit();
            }}
          />
          <CloudUpload className="size-5" />
          {pending ? "Uploading…" : "Click to upload photos or video"}
        </label>
      </form>

      {paths.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border py-10 text-center">
          <ImageIcon className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium">No photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {paths.map((path, i) => {
            const isVideo = VIDEO_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
            return (
              <div key={path} className="group relative overflow-hidden rounded-lg border border-border">
                {isVideo ? (
                  <video src={galleryUrl(bucket, path) ?? ""} className="aspect-4/3 w-full object-cover" muted />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={galleryUrl(bucket, path) ?? ""} alt="" className="aspect-4/3 w-full object-cover" />
                )}
                {isVideo ? (
                  <Badge className="absolute right-1.5 top-1.5 gap-1 border-transparent bg-foreground/70 text-background">
                    <Film className="size-3" /> Video
                  </Badge>
                ) : null}
                {i === 0 && !isVideo ? (
                  <Badge className="absolute left-1.5 top-1.5 gap-1 border-transparent bg-primary text-primary-foreground">
                    <Star className="size-3" /> Cover
                  </Badge>
                ) : null}
                <div className="flex items-center justify-between gap-1 p-1.5">
                  {i === 0 ? (
                    <span className="px-1 text-xs text-muted-foreground">Shown first</span>
                  ) : (
                    <form action={setCoverAction}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="path" value={path} />
                      <Button type="submit" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" disabled={isVideo}>
                        <Star className="size-3" /> Make cover
                      </Button>
                    </form>
                  )}
                  <form action={removeAction}>
                    <input type="hidden" name="id" value={id} />
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
            );
          })}
        </div>
      )}
    </div>
  );
}
