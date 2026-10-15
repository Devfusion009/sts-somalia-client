"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  CloudUpload,
  Film,
  ImageIcon,
  Loader2,
  RotateCw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/auth/actions";

const VIDEO_EXTENSIONS = [".mp4", ".webm"];
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const CONCURRENCY = 3;
const EASE = [0.22, 1, 0.36, 1] as const;

type UploadResult = ActionState & { upload?: { path: string; signedUrl: string } };

/**
 * Builds the public storage URL inline (rather than accepting a urlFor
 * function prop) because a plain function can't cross the Server → Client
 * Component boundary — only "use server" actions can. hotelImageUrl/
 * venueImageUrl in modules/{hotels,events}/images.ts do the exact same
 * thing; this mirrors their logic for the one property (bucket name) that
 * actually differs between them.
 */
type GalleryBucket = "hotel-images" | "venue-images" | "umrah-images";

function galleryUrl(bucket: GalleryBucket, path: string): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${bucket}/${path}` : null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s left`;
  return `${Math.round(seconds / 60)}m left`;
}

type Status = "queued" | "uploading" | "finishing" | "done" | "error";

type UploadItem = {
  key: string;
  name: string;
  size: number;
  isVideo: boolean;
  preview: string | null;
  status: Status;
  loaded: number;
  error: string | null;
};

/**
 * Streams one file to a Storage signed-upload URL with byte progress — the
 * reason uploads go browser → Storage directly instead of through a server
 * action, which can only report "started" and "finished". Rebuilt on the
 * public Supabase origin so a server-side internal URL never leaks into the
 * browser.
 */
function putToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (loaded: number) => void,
  register: (xhr: XMLHttpRequest) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const signed = new URL(signedUrl);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? signed.origin;
    const target = `${base.replace(/\/$/, "")}${signed.pathname}${signed.search}`;

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);

    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("PUT", target);
    xhr.setRequestHeader("x-upsert", "false");
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (key) xhr.setRequestHeader("apikey", key);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(file.size, Math.round((event.loaded / event.total) * file.size)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let message = "Upload failed.";
        try {
          message = JSON.parse(xhr.responseText)?.message ?? message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Network error. Check the connection and retry."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    xhr.send(body);
  });
}

function ProgressRing({ value, complete, failed }: { value: number; complete: boolean; failed: boolean }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="relative grid size-10 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="3" className="stroke-primary/12" />
        <motion.circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className={failed ? "stroke-destructive" : "stroke-primary"}
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - value) }}
          transition={{ duration: 0.45, ease: EASE }}
        />
      </svg>
      <AnimatePresence mode="wait" initial={false}>
        {complete ? (
          <motion.span
            key="done"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className={cn(
              "grid size-6 place-items-center rounded-full text-white",
              failed ? "bg-destructive" : "bg-primary"
            )}
          >
            {failed ? <AlertCircle className="size-3.5" /> : <Check className="size-3.5" strokeWidth={3} />}
          </motion.span>
        ) : (
          <motion.span
            key="pct"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[10px] font-semibold tabular-nums text-primary"
          >
            {Math.round(value * 100)}%
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function UploadRow({
  item,
  onCancel,
  onRetry,
}: {
  item: UploadItem;
  onCancel: (key: string) => void;
  onRetry: (key: string) => void;
}) {
  const fraction = item.size > 0 ? item.loaded / item.size : 0;
  const active = item.status === "uploading" || item.status === "finishing";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex items-center gap-3 px-4 py-3"
    >
      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/5">
        {item.preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.preview} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            {item.isVideo ? <Film className="size-4" /> : <ImageIcon className="size-4" />}
          </span>
        )}
        <AnimatePresence>
          {item.status === "done" ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 grid place-items-center bg-primary/55"
            >
              <motion.span
                initial={{ scale: 0.3 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 460, damping: 20 }}
              >
                <Check className="size-5 text-white" strokeWidth={3} />
              </motion.span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              item.status === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {item.status === "queued"
              ? "Queued"
              : item.status === "finishing"
                ? "Finishing"
                : item.status === "done"
                  ? formatBytes(item.size)
                  : item.status === "error"
                    ? "Failed"
                    : `${formatBytes(item.loaded)} / ${formatBytes(item.size)}`}
          </span>
        </div>
        {item.status === "error" ? (
          <p className="truncate text-xs text-destructive">{item.error}</p>
        ) : (
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn("absolute inset-y-0 left-0 rounded-full", item.status === "done" ? "bg-primary" : "bg-primary/85")}
              initial={false}
              animate={{ width: `${item.status === "done" || item.status === "finishing" ? 100 : Math.max(2, fraction * 100)}%` }}
              transition={{ duration: 0.4, ease: EASE }}
            />
            {active ? (
              <span className="animate-progress-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            ) : null}
          </div>
        )}
      </div>

      <div className="flex w-8 shrink-0 justify-end">
        {item.status === "error" ? (
          <button
            type="button"
            onClick={() => onRetry(item.key)}
            aria-label={`Retry ${item.name}`}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCw className="size-4" />
          </button>
        ) : item.status === "finishing" ? (
          <Loader2 className="size-4 animate-spin text-primary" aria-label="Finishing" />
        ) : item.status === "done" ? null : (
          <button
            type="button"
            onClick={() => onCancel(item.key)}
            aria-label={`Cancel ${item.name}`}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </motion.li>
  );
}

function TileButton({
  label,
  destructive,
  disabled,
  children,
}: {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      disabled={disabled || pending}
      className={cn(
        "grid size-8 place-items-center rounded-full bg-background/90 shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-all hover:scale-105 disabled:pointer-events-none disabled:opacity-50",
        destructive ? "text-destructive hover:bg-destructive hover:text-white" : "text-foreground hover:bg-primary hover:text-primary-foreground"
      )}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : children}
    </button>
  );
}

/**
 * Generic photo/video gallery editor shared by hotels, rooms and venues
 * (admin, partner and manager consoles). Files go straight from the browser
 * to Storage through the caller's upload action in two phases (sign, then
 * commit — see uploadImages in property-gallery-actions.ts), three at a
 * time, each with real byte progress; the caller's authorization runs on
 * both phases. Tiles enter the grid as each commit lands.
 */
export function GalleryManager({
  id,
  idField = "id",
  paths,
  bucket,
  imagesOnly = false,
  maxBytes = MAX_FILE_BYTES,
  uploadAction,
  removeAction,
  setCoverAction,
}: {
  id: string;
  /** FormData key the caller's actions read the record id from. */
  idField?: string;
  paths: string[];
  bucket: GalleryBucket;
  imagesOnly?: boolean;
  maxBytes?: number;
  uploadAction: (prev: ActionState, formData: FormData) => Promise<UploadResult>;
  removeAction: (formData: FormData) => Promise<void>;
  setCoverAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const accepted = imagesOnly ? ACCEPTED_TYPES.filter((t) => t.startsWith("image/")) : ACCEPTED_TYPES;
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const dragDepth = useRef(0);

  const files = useRef(new Map<string, File>());
  const xhrs = useRef(new Map<string, XMLHttpRequest>());
  const canceled = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const active = useRef(0);
  const [clock, setClock] = useState<{ start: number; now: number } | null>(null);
  const previews = useRef(new Set<string>());

  const patch = useCallback((key: string, next: Partial<UploadItem>) => {
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...next } : item)));
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    setClock((c) => (c ? { ...c, now } : { start: now, now }));
  }, []);

  const runOne = useCallback(
    async (key: string) => {
      const file = files.current.get(key);
      if (!file) return;
      patch(key, { status: "uploading", loaded: 0, error: null });

      const fail = (message: string) => patch(key, { status: "error", error: message });

      try {
        const signForm = new FormData();
        signForm.set(idField, id);
        signForm.set("phase", "sign");
        signForm.set("name", file.name);
        signForm.set("type", file.type);
        signForm.set("size", String(file.size));
        const signed = await uploadAction(null, signForm);
        if (canceled.current.has(key)) return;
        if (signed?.error) return fail(signed.error);

        if (!signed?.upload) {
          // A caller that doesn't support the two-phase protocol: one request, no byte progress.
          patch(key, { status: "finishing" });
          const legacy = new FormData();
          legacy.set(idField, id);
          legacy.append("files", file);
          const result = await uploadAction(null, legacy);
          if (result?.error) return fail(result.error);
          patch(key, { status: "done", loaded: file.size });
          return;
        }

        await putToSignedUrl(
          signed.upload.signedUrl,
          file,
          (loaded) => {
            patch(key, { loaded });
            tick();
          },
          (xhr) => xhrs.current.set(key, xhr)
        );
        xhrs.current.delete(key);
        if (canceled.current.has(key)) return;

        patch(key, { status: "finishing", loaded: file.size });
        const commitForm = new FormData();
        commitForm.set(idField, id);
        commitForm.set("phase", "commit");
        commitForm.set("path", signed.upload.path);
        const committed = await uploadAction(null, commitForm);
        if (committed?.error) return fail(committed.error);
        patch(key, { status: "done" });
      } catch (e) {
        xhrs.current.delete(key);
        if (e instanceof DOMException && e.name === "AbortError") return;
        fail(e instanceof Error ? e.message : "Upload failed.");
      }
    },
    [id, idField, patch, tick, uploadAction]
  );

  // Keeps up to CONCURRENCY uploads in flight; each finish pulls the next.
  const pump = useCallback(() => {
    function next() {
      while (active.current < CONCURRENCY && queue.current.length > 0) {
        const key = queue.current.shift()!;
        if (canceled.current.has(key)) continue;
        active.current += 1;
        void runOne(key).finally(() => {
          active.current -= 1;
          next();
        });
      }
    }
    next();
  }, [runOne]);

  const addFiles = useCallback(
    (list: File[]) => {
      if (list.length === 0) return;
      setCollapsed(false);
      // Nothing in flight: this drop starts a new batch, so its speed/ETA clock restarts.
      if (active.current === 0 && queue.current.length === 0) setClock(null);
      const added: UploadItem[] = list.map((file) => {
        const key = crypto.randomUUID();
        const isVideo = file.type.startsWith("video/");
        const preview = !isVideo && accepted.includes(file.type) ? URL.createObjectURL(file) : null;
        if (preview) previews.current.add(preview);
        const error = !accepted.includes(file.type)
          ? imagesOnly
            ? "Only JPG, PNG or WebP images are accepted."
            : "Only JPG, PNG, WebP, MP4 or WebM files are accepted."
          : file.size > maxBytes
            ? `Files must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.`
            : null;
        if (!error) {
          files.current.set(key, file);
          queue.current.push(key);
        }
        return {
          key,
          name: file.name,
          size: file.size,
          isVideo,
          preview,
          status: error ? "error" : "queued",
          loaded: 0,
          error,
        };
      });
      // A new drop after a finished batch starts a fresh tracker.
      setItems((current) =>
        current.every((i) => i.status === "done" || i.status === "error")
          ? [...current.filter((i) => i.status === "error"), ...added]
          : [...current, ...added]
      );
      pump();
    },
    [accepted, maxBytes, imagesOnly, pump]
  );

  function cancel(key: string) {
    canceled.current.add(key);
    queue.current = queue.current.filter((k) => k !== key);
    xhrs.current.get(key)?.abort();
    files.current.delete(key);
    setItems((list) => list.filter((item) => item.key !== key));
  }

  function retry(key: string) {
    if (!files.current.has(key)) {
      setItems((list) => list.filter((item) => item.key !== key));
      return;
    }
    canceled.current.delete(key);
    patch(key, { status: "queued", loaded: 0, error: null });
    queue.current.push(key);
    pump();
  }

  function clearAll() {
    for (const key of queue.current) canceled.current.add(key);
    queue.current = [];
    for (const xhr of xhrs.current.values()) xhr.abort();
    for (const url of previews.current) URL.revokeObjectURL(url);
    previews.current.clear();
    files.current.clear();
    setClock(null);
    setItems([]);
  }

  const settled = items.length > 0 && items.every((i) => i.status === "done" || i.status === "error");
  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "error").length;
  const working = items.filter((i) => i.status !== "error");
  const totalBytes = working.reduce((sum, i) => sum + i.size, 0);
  const loadedBytes = working.reduce((sum, i) => sum + (i.status === "done" || i.status === "finishing" ? i.size : i.loaded), 0);
  const fraction = totalBytes > 0 ? loadedBytes / totalBytes : settled ? 1 : 0;

  // Once a batch settles: pull the committed tiles in, and dismiss the
  // tracker on its own when nothing needs attention.
  useEffect(() => {
    if (!settled) return;
    if (doneCount > 0) router.refresh();
    if (failedCount > 0) return;
    const timer = window.setTimeout(clearAll, 2600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per settle
  }, [settled, doneCount, failedCount]);

  useEffect(() => {
    const urls = previews.current;
    const pending = xhrs.current;
    return () => {
      for (const xhr of pending.values()) xhr.abort();
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const elapsed = clock ? (clock.now - clock.start) / 1000 : 0;
  const speed = elapsed > 0.5 ? loadedBytes / elapsed : 0;
  const eta = speed > 0 ? (totalBytes - loadedBytes) / speed : 0;
  const inFlight = items.length - doneCount - failedCount;

  const headline = settled
    ? failedCount === 0
      ? `${doneCount} ${doneCount === 1 ? "file" : "files"} uploaded`
      : `${doneCount} uploaded · ${failedCount} failed`
    : `Uploading ${Math.min(doneCount + 1, items.length - failedCount)} of ${items.length - failedCount}`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          aria-label={imagesOnly ? "Upload photos" : "Upload photos or video"}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            addFiles(Array.from(e.dataTransfer.files ?? []));
          }}
          className={cn(
            "group relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed px-6 py-9 text-center outline-none transition-all duration-300",
            "focus-visible:ring-3 focus-visible:ring-ring/50",
            dragging
              ? "scale-[1.01] border-primary bg-primary/[0.06] shadow-[0_0_0_4px] shadow-primary/10"
              : "border-foreground/15 bg-gradient-to-b from-muted/40 to-transparent hover:border-primary/50 hover:bg-primary/[0.03]"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accepted.join(",")}
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <motion.span
            animate={dragging ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className={cn(
              "grid size-12 place-items-center rounded-2xl ring-1 transition-colors duration-300",
              dragging
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-background text-primary shadow-sm ring-foreground/10 group-hover:ring-primary/30"
            )}
          >
            <CloudUpload className="size-5.5" />
          </motion.span>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{dragging ? "Release to upload" : imagesOnly ? "Drop photos here" : "Drop photos or video here"}</p>
            <p className="text-sm text-muted-foreground">
              or <span className="font-medium text-primary underline-offset-4 group-hover:underline">browse files</span>
            </p>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {items.length > 0 ? (
            <motion.section
              key="tracker"
              aria-label="Uploads"
              aria-live="polite"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="relative h-0.5 bg-muted">
                  <motion.div
                    className={cn("absolute inset-y-0 left-0", failedCount > 0 && settled ? "bg-destructive" : "bg-primary")}
                    initial={false}
                    animate={{ width: `${fraction * 100}%` }}
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <ProgressRing value={fraction} complete={settled} failed={settled && doneCount === 0} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{headline}</p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      {formatBytes(loadedBytes)} of {formatBytes(totalBytes)}
                      {!settled && speed > 0 ? ` · ${formatBytes(speed)}/s` : ""}
                      {!settled && eta > 0 ? ` · ${formatEta(eta)}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => !c)}
                    aria-label={collapsed ? "Show files" : "Hide files"}
                    aria-expanded={!collapsed}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronDown className={cn("size-4 transition-transform duration-300", collapsed && "-rotate-90")} />
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    aria-label={inFlight > 0 ? "Cancel uploads" : "Dismiss"}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {!collapsed ? (
                    <motion.div
                      key="list"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <ul className="max-h-80 divide-y divide-border overflow-y-auto border-t border-border">
                        <AnimatePresence initial={false}>
                          {items.map((item) => (
                            <UploadRow key={item.key} item={item} onCancel={cancel} onRetry={retry} />
                          ))}
                        </AnimatePresence>
                      </ul>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        {paths.length === 0 && items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border py-10 text-center">
            <ImageIcon className="size-7 text-muted-foreground" />
            <p className="text-sm font-medium">No photos yet</p>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence initial={false}>
              {paths.map((path, i) => {
                const isVideo = VIDEO_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
                const isCover = i === 0 && !isVideo;
                return (
                  <motion.div
                    key={path}
                    layout
                    initial={{ opacity: 0, scale: 0.92, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className={cn(
                      "group relative overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10",
                      isCover && "ring-2 ring-primary"
                    )}
                  >
                    {isVideo ? (
                      <video src={galleryUrl(bucket, path) ?? ""} className="aspect-4/3 w-full object-cover" muted />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={galleryUrl(bucket, path) ?? ""}
                        alt=""
                        className="aspect-4/3 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-focus-within:opacity-100 group-hover:opacity-100" />

                    {isCover ? (
                      <Badge className="absolute top-2 left-2 gap-1 border-transparent bg-primary text-primary-foreground shadow-sm">
                        <Star className="size-3 fill-current" /> Cover
                      </Badge>
                    ) : null}
                    {isVideo ? (
                      <Badge className="absolute top-2 left-2 gap-1 border-transparent bg-foreground/75 text-background">
                        <Film className="size-3" /> Video
                      </Badge>
                    ) : null}

                    <div className="absolute right-2 bottom-2 flex gap-1.5 opacity-100 transition-all duration-300 sm:translate-y-1 sm:opacity-0 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
                      {!isCover && !isVideo ? (
                        <form action={setCoverAction}>
                          <input type="hidden" name={idField} value={id} />
                          <input type="hidden" name="path" value={path} />
                          <TileButton label="Make cover">
                            <Star className="size-3.5" />
                          </TileButton>
                        </form>
                      ) : null}
                      <form action={removeAction}>
                        <input type="hidden" name={idField} value={id} />
                        <input type="hidden" name="path" value={path} />
                        <ConfirmButton
                          title={isVideo ? "Delete this video?" : "Delete this photo?"}
                          aria-label="Delete"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full bg-background/90 text-destructive shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-all hover:scale-105 hover:bg-destructive hover:text-white"
                        >
                          <Trash2 className="size-3.5" />
                        </ConfirmButton>
                      </form>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </MotionConfig>
  );
}
