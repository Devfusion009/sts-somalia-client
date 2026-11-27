"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Cloud, CloudOff, Loader2, Save } from "lucide-react";
import { draftDetails, draftFields, readLocalDraft, type DraftSnapshot } from "../draft-fields";
import { saveApplicationDraft, type DraftRow } from "../drafts";
import type { ApplicationKind } from "../config";
import type { ApplicationRow } from "../queries";

const DraftContext=createContext<((form:HTMLFormElement)=>void)|null>(null);
export function useDraftCapture(formRef:React.RefObject<HTMLFormElement|null>) {
  const capture=useContext(DraftContext);
  return useCallback(()=>{ if(formRef.current) capture?.(formRef.current); },[capture,formRef]);
}
export type DraftApplication = ApplicationRow & { draftOwner?:string; drafts?:DraftRow[] };

export function DraftStep({kind,application,step,children}:{kind:ApplicationKind;application:DraftApplication;step:number;children:(application:DraftApplication)=>ReactNode}) {
  const router=useRouter();
  const root=useRef<HTMLDivElement>(null);
  const server=application.drafts?.find(d=>d.step===step);
  const key=`sts-partner-draft:${application.draftOwner}:${kind}:${application.id}:${step}`;
  const [restored,setRestored]=useState<DraftSnapshot|null>(null);
  const [ready,setReady]=useState(false);
  const [status,setStatus]=useState("Loading draft…");
  const [offline,setOffline]=useState(false);
  const [savedAt,setSavedAt]=useState<number|null>(null);
  const revision=useRef(server?.revision ?? 0);
  const latest=useRef<DraftSnapshot|null>(null);
  const synced=useRef("");
  const saving=useRef(false);
  const conflicted=useRef(false);
  const alive=useRef(true);
  const submitting=useRef(false);
  const deviceSaved=useRef(true);
  const [conflict,setConflict]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const frame=useRef<ReturnType<typeof setTimeout>|null>(null);

  const persist=useCallback((snapshot:DraftSnapshot)=>{
    try {
      localStorage.setItem(key,JSON.stringify({...snapshot,revision:revision.current}));
      localStorage.setItem(`${key}:progress`,JSON.stringify({step,savedAt:snapshot.savedAt}));
      return true;
    } catch { return false; }
  },[key,step]);

  const sync=useCallback(async():Promise<void>=>{
    if(saving.current || conflicted.current || !latest.current || !navigator.onLine) return;
    const snapshot=latest.current;
    const signature=JSON.stringify(snapshot.fields);
    if(signature===synced.current) return;
    saving.current=true;
    if(alive.current) setStatus("Saving draft…");
    try {
      const result=await saveApplicationDraft({kind,id:application.id,step,fields:snapshot.fields,revision:revision.current});
      if(result.conflict) {conflicted.current=true; if(alive.current) {setConflict(true);setStatus("Draft changed on another device");}}
      else if(result.error) {if(alive.current) setStatus(deviceSaved.current?"Saved on this device · sync pending":"Draft not saved · retry before leaving");}
      else {
        revision.current=result.revision!;
        synced.current=signature;
        if(latest.current) deviceSaved.current=persist(latest.current);
        if(alive.current) {setStatus("Draft saved");setSavedAt(result.savedAt!);}
      }
    } catch {if(alive.current) setStatus(deviceSaved.current?"Saved on this device · sync pending":"Draft not saved · retry before leaving");}
    finally {
      saving.current=false;
      if(alive.current && !conflicted.current && latest.current && JSON.stringify(latest.current.fields)!==signature) timer.current=setTimeout(()=>void sync(),900);
    }
  },[application.id,kind,step,setStatus,setSavedAt,setConflict,persist]);

  const captureNow=useCallback((form:HTMLFormElement)=>{
    const fields=draftFields(kind,step,Object.fromEntries(new FormData(form)));
    const signature=JSON.stringify(fields);
    if(latest.current && JSON.stringify(latest.current.fields)===signature) return;
    latest.current={fields,savedAt:Date.now()};
    const local=persist(latest.current);
    deviceSaved.current=local;
    setSavedAt(latest.current.savedAt);
    setStatus(local ? navigator.onLine?"Saving draft…":"Saved offline on this device" : "Device storage unavailable · keep this page open");
    if(timer.current) clearTimeout(timer.current);
    timer.current=setTimeout(()=>void sync(),900);
  },[kind,step,persist,sync,setStatus,setSavedAt]);
  const capture=useCallback((form:HTMLFormElement)=>{
    // Custom controls update hidden inputs in their React commit.
    if(frame.current) clearTimeout(frame.current);
    frame.current=setTimeout(()=>{submitting.current=false;captureNow(form);},0);
  },[captureNow]);

  useEffect(()=>{
    alive.current=true;
    let local:DraftSnapshot|null=null;
    try {const raw=localStorage.getItem(key);local=readLocalDraft(raw);if(raw && !local){localStorage.removeItem(key);localStorage.removeItem(`${key}:progress`);}} catch {}
    const remote=server?{fields:server.fields,savedAt:Date.parse(server.saved_at)}:null;
    const chosen=local && (!remote || local.savedAt>remote.savedAt)?local:remote;
    latest.current=chosen;
    synced.current=remote?JSON.stringify(remote.fields):"";
    Promise.resolve().then(()=>{
      if(!alive.current) return;
      setRestored(chosen);setReady(true);setOffline(!navigator.onLine);setSavedAt(chosen?.savedAt ?? null);
      setStatus(chosen ? navigator.onLine?"Draft restored":"Saved offline on this device":"Draft ready");
      if(chosen && local && chosen === local && local.revision !== undefined && local.revision !== revision.current && JSON.stringify(local.fields)!==synced.current) {
        conflicted.current=true;setConflict(true);setStatus("Draft changed on another device");
      } else if(chosen) void sync();
    });
    const online=()=>{setOffline(false);void sync();};
    const offline=()=>{setOffline(true);setStatus(deviceSaved.current?"Offline · changes stay on this device":"Device storage unavailable · keep this page open");};
    const flush=()=>{const form=root.current?.querySelector("form");if(form && !submitting.current) captureNow(form);};
    const visibility=()=>{if(document.visibilityState==="hidden") flush();};
    window.addEventListener("online",online);window.addEventListener("offline",offline);
    window.addEventListener("pagehide",flush);document.addEventListener("visibilitychange",visibility);
    return ()=>{
      flush();alive.current=false;
      if(timer.current) clearTimeout(timer.current);if(frame.current) clearTimeout(frame.current);
      window.removeEventListener("online",online);window.removeEventListener("offline",offline);
      window.removeEventListener("pagehide",flush);document.removeEventListener("visibilitychange",visibility);
    };
    // Restoring is once per step. Revalidation must not remount fields while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);

  const details=draftDetails(application.business_details,restored?draftFields(kind,step,restored.fields):{});
  return <DraftContext.Provider value={capture}><div ref={root} className="space-y-5" onSubmitCapture={event=>{if(frame.current) clearTimeout(frame.current);captureNow(event.target as HTMLFormElement);if(!navigator.onLine){event.preventDefault();setStatus(deviceSaved.current?"Saved offline · reconnect to continue":"Device storage unavailable · keep this page open");return;}submitting.current=true;void sync();}}>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium">
        {offline?<CloudOff className="size-4 text-amber-700" aria-hidden/>:status==="Saving draft…"?<Loader2 className="size-4 animate-spin text-primary" aria-hidden/>:savedAt?<CheckCircle2 className="size-4 text-primary" aria-hidden/>:<Cloud className="size-4 text-primary" aria-hidden/>}
        <span>{status}</span>{savedAt && <time className="hidden text-xs font-normal text-muted-foreground sm:inline" dateTime={new Date(savedAt).toISOString()}>{new Date(savedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time>}
      </div>
      <button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-primary" onClick={async()=>{
        const form=root.current?.querySelector("form");if(form) captureNow(form);
        if(!navigator.onLine){setStatus(deviceSaved.current?"Saved offline on this device":"Device storage unavailable · keep this page open");return;}
        await sync();router.push("/account/become");
      }}><Save className="size-4" aria-hidden/>{offline?"Save on device":"Save & exit"}</button>
    </div>
    {conflict && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><span>Review your restored entries before replacing the account draft.</span><button type="button" className="min-h-9 rounded-lg border border-amber-300 px-3 font-semibold" onClick={()=>{conflicted.current=false;setConflict(false);void sync();}}>Save this version</button></div>}
    {ready?children({...application,business_details:details}):<div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden/>Restoring application…</div>}
  </div></DraftContext.Provider>;
}
