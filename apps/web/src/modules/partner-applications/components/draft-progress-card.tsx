"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, FilePenLine } from "lucide-react";
import { APP_CONFIG, stepLabel, stepsFor, type ApplicationKind } from "../config";
import { DRAFT_MAX_AGE } from "../draft-fields";

export function DraftProgressCard({kind,id,owner,maxStep,serverStep,savedAt}:{kind:ApplicationKind;id:string;owner:string;maxStep:number;serverStep:number;savedAt:number|null}) {
  const [progress,setProgress]=useState({step:serverStep,savedAt,local:false});
  const steps=stepsFor(kind);
  useEffect(()=>{
    let newest={step:serverStep,savedAt,local:false};
    try {
      for(const step of stepsFor(kind).filter(s=>s<=4 && s<=maxStep)) {
        const value=JSON.parse(localStorage.getItem(`sts-partner-draft:${owner}:${kind}:${id}:${step}:progress`) ?? "null");
        if(value && Number.isFinite(value.savedAt) && value.savedAt<=Date.now()+60000 && Date.now()-value.savedAt<DRAFT_MAX_AGE && value.savedAt>(newest.savedAt ?? 0)) newest={step,savedAt:value.savedAt,local:true};
      }
    } catch {}
    Promise.resolve().then(()=>setProgress(newest));
  },[kind,id,owner,maxStep,serverStep,savedAt]);
  const index=Math.max(0,steps.indexOf(progress.step));
  return <article className="rounded-xl border border-primary/15 bg-card p-5 shadow-xs">
    <div className="mb-4 flex items-center justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><FilePenLine className="size-5" aria-hidden/></span><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200"><Clock3 className="size-3.5" aria-hidden/>In progress</span></div>
    <h3 className="font-semibold">{APP_CONFIG[kind].label}</h3>
    <div className="mt-4 flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Step {index+1} of {steps.length}</span><span className="font-medium">{stepLabel(kind,progress.step)}</span></div>
    <div role="progressbar" aria-label="Completed application steps" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${index/steps.length*100}%`}}/></div>
    {progress.savedAt && <div className="mt-3 text-xs text-muted-foreground">{progress.local?"Saved on this device":"Draft saved"} · <time dateTime={new Date(progress.savedAt).toISOString()}>{new Date(progress.savedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}</time></div>}
    <Link href={`/account/become/${kind}/${id}?step=${progress.step}`} className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Continue application</Link>
  </article>;
}
