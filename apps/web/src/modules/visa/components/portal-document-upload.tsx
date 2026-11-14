"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { preparePortalUpload, completePortalUpload, type PortalUploadInput } from "../portal-upload-actions";
import { transferFile } from "../transfer-file";

async function deadline<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("The request timed out. Refresh to check the document status.")), 30000); })]); }
  finally { clearTimeout(timer); }
}

export function PortalDocumentUpload({ applicationId, targetId, kind, slotKey }: { applicationId: string; targetId: string; kind: "request" | "replace" | "missing"; slotKey?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "uploading" | "saving" | "uncertain">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { operation.current?.abort(); }, []);
  const busy = ["preparing", "uploading", "saving"].includes(phase);
  async function upload(chosen: File) {
    if (operation.current) return;
    if (!chosen.size || chosen.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "application/pdf"].includes(chosen.type)) { setError("Choose a JPG, PNG or PDF file, up to 5MB."); return; }
    const controller = new AbortController(); operation.current = controller;
    setError(null); setFile(chosen); setPercent(0); setPhase("preparing");
    let saving = false;
    const data: PortalUploadInput = { applicationId, targetId, kind, slotKey, name: chosen.name, size: chosen.size, type: chosen.type as PortalUploadInput["type"] };
    try {
      const prepared = await deadline(preparePortalUpload(data));
      if (controller.signal.aborted) return;
      if (prepared.error || !prepared.url || !prepared.path) throw new Error(prepared.error || "Upload could not be started.");
      setPhase("uploading");
      await transferFile(prepared.url, chosen, controller.signal, setPercent);
      if (controller.signal.aborted) return;
      saving = true; setPhase("saving");
      const result = await deadline(completePortalUpload(data, prepared.path));
      if (result.error) { saving = false; throw new Error(result.error); }
      if (!controller.signal.aborted) window.location.reload();
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Upload failed. Please try again.");
      setPhase(saving ? "uncertain" : "idle");
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  }
  function cancel() { operation.current?.abort(); operation.current = null; setPhase("idle"); setFile(null); setError("Upload cancelled."); }
  return <div className="flex max-w-full flex-col items-end gap-2">
    <input ref={input} type="file" accept=".jpg,.jpeg,.png,.pdf" aria-label={kind !== "replace" ? "Upload requested document" : "Replace rejected document"} className="sr-only" onChange={event => { const chosen = event.target.files?.[0]; event.target.value = ""; if (chosen) void upload(chosen); }} />
    <div className="flex gap-2"><Button type="button" variant="outline" disabled={busy || phase === "uncertain"} onClick={() => input.current?.click()}><Upload className="size-4" />{busy ? phase === "saving" ? "Saving…" : "Uploading…" : kind !== "replace" ? "Upload" : "Replace"}</Button>
      {phase === "preparing" || phase === "uploading" ? <Button type="button" variant="ghost" onClick={cancel}><X className="size-4" />Cancel upload</Button> : null}
      {phase === "uncertain" ? <Button type="button" variant="outline" onClick={() => window.location.reload()}>Check status</Button> : null}
    </div>
    {busy && file ? <div className="w-64 max-w-full space-y-2 rounded-lg border border-border p-3 text-xs" role="status"><span className="block truncate font-medium">{file.name}</span><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} /></div><span>{phase === "preparing" ? "Preparing upload…" : phase === "saving" ? "Upload complete · Saving document…" : `${percent}% uploaded`}</span></div> : null}
    {error ? <p role="status" className="max-w-72 text-xs text-destructive">{error}</p> : null}
  </div>;
}
