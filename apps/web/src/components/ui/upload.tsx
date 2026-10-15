"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { AlertCircle, Check, CloudUpload, FileText, Film, ImageIcon, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "@/components/ui/confirm-button";

/**
 * Shared upload UI for every file input in the app:
 *  - <FileField>: a drop-in for <input type="file" name=…> inside a form.
 *    Keeps a real, named file input so server actions read FormData exactly
 *    as before; adds drag-and-drop, previews, and live tracking while the
 *    form submits.
 *  - <UploadStatus>: the tracking card for pick-and-upload controls that
 *    submit on their own (logo, visa documents, …).
 * Server actions expose no byte progress, so the bar here is an estimate
 * paced by file size and never claims a percentage; it completes when the
 * request does. The gallery (direct-to-Storage) has real byte progress.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Seconds the estimated bar takes to reach 90% — about 1.5 MB/s, never under a second. */
function estimateSeconds(bytes: number) {
  return Math.min(30, Math.max(1.2, bytes / (1.5 * 1024 * 1024)));
}

function acceptsFile(file: File, accept?: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) =>
      rule.startsWith(".")
        ? name.endsWith(rule)
        : rule.endsWith("/*")
          ? file.type.startsWith(rule.slice(0, -1))
          : file.type === rule
    );
}

type ChipState = "selected" | "uploading" | "done" | "error";

function FileIcon({ file }: { file: { name: string; type: string } }) {
  if (file.type.startsWith("video/")) return <Film className="size-4" />;
  if (file.type.startsWith("image/")) return <ImageIcon className="size-4" />;
  return <FileText className="size-4" />;
}

/** One file row: preview, name, size, and the tracking bar while it uploads. */
export function UploadChip({
  file,
  preview,
  state,
  error,
  onRemove,
}: {
  file: { name: string; size: number; type: string };
  preview?: string | null;
  state: ChipState;
  error?: string | null;
  onRemove?: () => void;
}) {
  const seconds = estimateSeconds(file.size);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.18 } }}
      transition={{ duration: 0.32, ease: EASE }}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-xs",
        state === "error" ? "border-destructive/40" : state === "done" ? "border-primary/40" : "border-border"
      )}
    >
      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 ring-foreground/5">
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <FileIcon file={file} />
        )}
        <AnimatePresence>
          {state === "done" ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 grid place-items-center bg-primary text-primary-foreground"
            >
              <motion.span
                initial={{ scale: 0.3 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 460, damping: 20 }}
              >
                <Check className="size-4" strokeWidth={3} />
              </motion.span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              state === "error" ? "text-destructive" : state === "done" ? "text-primary" : "text-muted-foreground"
            )}
          >
            {state === "uploading" ? "Uploading" : state === "done" ? "Uploaded" : state === "error" ? "Failed" : formatBytes(file.size)}
          </span>
        </div>
        <AnimatePresence initial={false} mode="wait">
          {state === "error" && error ? (
            <motion.p
              key="err"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="truncate text-xs text-destructive"
            >
              {error}
            </motion.p>
          ) : state === "uploading" || state === "done" ? (
            <motion.div
              key="bar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative h-1 overflow-hidden rounded-full bg-muted"
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                initial={{ width: "3%" }}
                animate={{ width: state === "done" ? "100%" : "90%" }}
                transition={state === "done" ? { duration: 0.3, ease: EASE } : { duration: seconds, ease: [0.1, 0.6, 0.3, 1] }}
              />
              {state === "uploading" ? (
                <span className="animate-progress-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <span className="grid size-7 shrink-0 place-items-center">
        {state === "uploading" ? (
          <Loader2 className="size-4 animate-spin text-primary" aria-label="Uploading" />
        ) : state === "error" ? (
          <AlertCircle className="size-4 text-destructive" />
        ) : onRemove && state === "selected" ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${file.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </span>
    </motion.div>
  );
}

type Picked = { key: string; file: File; preview: string | null };

/**
 * Form file field. Renders inside the form so it can read the submission
 * state; a native `reset` (React resets form fields after an action) clears
 * it, exactly like the plain input it replaces.
 */
export function FileField({
  id,
  name,
  accept,
  required,
  multiple,
  maxBytes,
  validate,
  disabled,
  label,
  compact,
  onFilesChange,
  autoSubmit,
  className,
}: {
  id?: string;
  name: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  maxBytes?: number;
  /** Extra per-file check; return an error line to reject the file. */
  validate?: (file: File) => string | null;
  disabled?: boolean;
  label?: string;
  /** One-line dropzone for dense forms and grids. */
  compact?: boolean;
  onFilesChange?: (files: File[]) => void;
  /** Submit the form as soon as a valid file is picked. */
  autoSubmit?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [rejected, setRejected] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const previews = useRef(new Set<string>());
  const { pending } = useFormStatus();

  function sync(next: Picked[]) {
    const transfer = new DataTransfer();
    for (const p of next) transfer.items.add(p.file);
    if (inputRef.current) inputRef.current.files = transfer.files;
    setPicked(next);
    onFilesChange?.(next.map((p) => p.file));
  }

  function take(list: File[]) {
    if (list.length === 0) return;
    const incoming = multiple ? list : list.slice(0, 1);
    for (const file of incoming) {
      const problem = !acceptsFile(file, accept)
        ? "This file type isn't accepted."
        : maxBytes && file.size > maxBytes
          ? `Files must be ${formatBytes(maxBytes)} or smaller.`
          : (validate?.(file) ?? null);
      if (problem) {
        setRejected(`${file.name}: ${problem}`);
        sync(picked);
        return;
      }
    }
    setRejected(null);
    const added = incoming.map((file) => {
      const preview = file.type.startsWith("image/") && file.type !== "image/heic" ? URL.createObjectURL(file) : null;
      if (preview) previews.current.add(preview);
      return { key: crypto.randomUUID(), file, preview };
    });
    sync(multiple ? [...picked, ...added] : added);
    if (autoSubmit) requestAnimationFrame(() => inputRef.current?.form?.requestSubmit());
  }

  function remove(key: string) {
    sync(picked.filter((p) => p.key !== key));
  }

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setPicked([]);
      setRejected(null);
      onFilesChange?.([]);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [onFilesChange]);

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const showZone = multiple || picked.length === 0;
  const busy = pending && picked.length > 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("space-y-2", className)}>
        <input
          ref={inputRef}
          id={id}
          type="file"
          name={name}
          accept={accept}
          required={required}
          multiple={multiple}
          disabled={disabled}
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => take(Array.from(e.target.files ?? []))}
        />

        <AnimatePresence initial={false}>
          {showZone ? (
            <motion.div
              key="zone"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <div
                role="button"
                tabIndex={disabled || busy ? -1 : 0}
                aria-label={label ?? "Choose file"}
                aria-disabled={disabled || busy}
                onClick={() => !disabled && !busy && inputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !disabled && !busy) {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  depth.current += 1;
                  setDragging(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => {
                  e.preventDefault();
                  depth.current = Math.max(0, depth.current - 1);
                  if (depth.current === 0) setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  depth.current = 0;
                  setDragging(false);
                  if (!disabled && !busy) take(Array.from(e.dataTransfer.files ?? []));
                }}
                className={cn(
                  "group flex cursor-pointer items-center rounded-lg border border-dashed text-sm outline-none transition-all duration-300 focus-visible:ring-3 focus-visible:ring-ring/50",
                  compact ? "gap-2.5 px-3 py-2" : "flex-col justify-center gap-2 px-4 py-5 text-center",
                  dragging
                    ? "border-primary bg-primary/[0.06] shadow-[0_0_0_3px] shadow-primary/10"
                    : rejected
                      ? "border-destructive/50 bg-destructive/[0.03]"
                      : "border-foreground/15 bg-muted/20 hover:border-primary/50 hover:bg-primary/[0.03]",
                  (disabled || busy) && "pointer-events-none opacity-60"
                )}
              >
                <motion.span
                  animate={dragging ? { y: -3, scale: 1.08 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 20 }}
                  className={cn(
                    "grid shrink-0 place-items-center rounded-lg ring-1 transition-colors duration-300",
                    compact ? "size-7" : "size-9",
                    dragging
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-background text-primary ring-foreground/10 group-hover:ring-primary/30"
                  )}
                >
                  <CloudUpload className="size-4" />
                </motion.span>
                <span className={cn("text-muted-foreground", compact && "truncate")}>
                  {dragging ? (
                    <span className="font-medium text-foreground">Release to add</span>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{label ?? (multiple ? "Drop files" : "Drop a file")}</span>{" "}
                      or <span className="font-medium text-primary underline-offset-4 group-hover:underline">browse</span>
                    </>
                  )}
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {rejected ? (
            <motion.p
              key="rejected"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden text-xs text-destructive"
            >
              {rejected}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {picked.length > 0 ? (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {picked.map((p) => (
                <UploadChip
                  key={p.key}
                  file={p.file}
                  preview={p.preview}
                  state={busy ? "uploading" : "selected"}
                  onRemove={disabled || autoSubmit ? undefined : () => remove(p.key)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </MotionConfig>
  );
}

/**
 * Tracking card for controls that upload the moment a file is picked.
 * Pass the picked file and the action's pending flag / error; it shows the
 * file uploading, then a confirmation that clears itself, or the error.
 */
export function UploadStatus({
  file,
  pending,
  error,
  className,
}: {
  file: File | null;
  pending: boolean;
  error?: string | null;
  className?: string;
}) {
  const [phase, setPhase] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [shown, setShown] = useState<File | null>(null);
  const [prev, setPrev] = useState({ pending, file });

  if (prev.pending !== pending || prev.file !== file) {
    setPrev({ pending, file });
    if (pending && file) {
      setShown(file);
      setPhase("uploading");
    } else if (!pending && prev.pending && shown) {
      setPhase(error ? "error" : "done");
    }
  }

  useEffect(() => {
    if (phase !== "done" && phase !== "error") return;
    const timer = window.setTimeout(() => setPhase("idle"), phase === "done" ? 1800 : 4000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={false}>
        {phase !== "idle" && shown ? (
          <motion.div
            key="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className={cn("overflow-hidden", className)}
          >
            <div className="pt-2">
              <UploadChip file={shown} state={phase} error={error} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}

/**
 * Square logo tile that is itself the drop target. Picking or dropping a
 * file uploads it at once; the new image previews inside the tile while it
 * uploads and settles with a check.
 */
export function LogoUploader({
  logoUrl,
  alt,
  action,
  removeAction,
  fields = {},
  accept = "image/jpeg,image/png,image/webp,image/svg+xml",
  validate,
}: {
  logoUrl: string | null;
  alt: string;
  action: (prev: { error: string | null } | null, formData: FormData) => Promise<{ error: string | null } | null>;
  removeAction?: (formData: FormData) => Promise<void>;
  fields?: Record<string, string>;
  accept?: string;
  validate?: (file: File) => string | null;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const [wasPending, setWasPending] = useState(false);

  if (wasPending !== pending) {
    setWasPending(pending);
    if (!pending) {
      if (!state?.error) setDone(true);
      setPreview(null);
    }
  }

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(false), 1600);
    return () => window.clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function take(file: File | undefined) {
    if (!file || !inputRef.current) return;
    const problem = !acceptsFile(file, accept) ? "This file type isn't accepted." : (validate?.(file) ?? null);
    setLocalError(problem);
    if (problem) {
      inputRef.current.value = "";
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
    setPreview(URL.createObjectURL(file));
    formRef.current?.requestSubmit();
  }

  const error = localError ?? state?.error ?? null;
  const shown = preview ?? logoUrl;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex items-center gap-4">
        <form ref={formRef} action={formAction}>
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept={accept}
            tabIndex={-1}
            className="sr-only"
            onChange={(e) => take(e.target.files?.[0])}
          />
          <button
            type="button"
            aria-label={logoUrl ? "Replace logo" : "Upload logo"}
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              take(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "group relative grid size-24 place-items-center overflow-hidden rounded-2xl border bg-muted transition-all duration-300 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              dragging ? "scale-105 border-primary ring-4 ring-primary/15" : "border-border hover:border-primary/50"
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {shown ? (
                <motion.img
                  key={shown}
                  src={shown}
                  alt={alt}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: pending ? 0.45 : 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="size-full object-contain p-1.5"
                />
              ) : (
                <motion.span key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground">
                  <CloudUpload className="size-7" />
                </motion.span>
              )}
            </AnimatePresence>

            {!pending && !done ? (
              <span className="absolute inset-0 grid place-items-center bg-foreground/55 text-background opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                <CloudUpload className="size-6" />
              </span>
            ) : null}

            <AnimatePresence>
              {pending ? (
                <motion.span
                  key="ring"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 grid place-items-center"
                >
                  <svg viewBox="0 0 40 40" className="size-12 animate-spin [animation-duration:1.1s]" aria-hidden>
                    <circle cx="20" cy="20" r="16" fill="none" strokeWidth="3" className="stroke-background/80" />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="100.5"
                      strokeDashoffset="70"
                      className="stroke-primary"
                    />
                  </svg>
                </motion.span>
              ) : done ? (
                <motion.span
                  key="done"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 20 }}
                  className="absolute inset-0 grid place-items-center"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <Check className="size-5" strokeWidth={3} />
                  </span>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
        </form>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
              {pending ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {logoUrl && removeAction && !pending ? (
              <form action={removeAction}>
                {Object.entries(fields).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <ConfirmButton
                  title="Remove this logo?"
                  confirmLabel="Remove"
                  aria-label="Remove logo"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" />
                </ConfirmButton>
              </form>
            ) : null}
          </div>
          <AnimatePresence initial={false}>
            {error ? (
              <motion.p
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-1.5 overflow-hidden text-xs text-destructive"
              >
                <AlertCircle className="size-3.5 shrink-0" /> {error}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
