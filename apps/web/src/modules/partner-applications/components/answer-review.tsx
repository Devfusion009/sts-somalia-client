"use client";

import { createContext, useContext, useState, useActionState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Check, MessageSquare, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { requestMoreInfo } from "@/modules/admin/application-actions";
import type { ApplicationType } from "@/modules/admin/queries";
import { cn } from "@/lib/utils";

type Review = { label: string; value?: string; status: "accepted" | "change"; note: string };
type Registered = {label:string;value?:string;section:string};
type ReviewContext = { enabled:boolean; activeSection:string; setActiveSection:(id:string)=>void; registered:Record<string,Registered>; register:(key:string,value:Registered|null)=>void; reviews: Record<string, Review>; update: (key: string, review?: Review) => void; sent: boolean };
const Context = createContext<ReviewContext | null>(null);

export function useAnswerReview() { return useContext(Context); }

export function AnswerReviewProvider({ children, applicationId, type, enabled }: {
  children: ReactNode; applicationId: string; type: ApplicationType; enabled: boolean;
}) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [state, action] = useActionState(requestMoreInfo.bind(null, type), null);
  const sent = state !== null && !state.error;
  const [activeSection,setActiveSection]=useState(type === "affiliate" ? "about" : "business");
  const [registered,setRegistered]=useState<Record<string,Registered>>({});
  const register=useCallback((key:string,value:Registered|null)=>setRegistered(previous=>{const next={...previous};if(value) next[key]=value;else delete next[key];return next;}),[]);
  const entries = Object.values(reviews);
  const changes = entries.filter(r => r.status === "change");
  const message = changes.map((r, i) => `${i + 1}. ${r.label}${r.value ? ` (submitted: ${r.value})` : ""}\n${r.note.trim()}`).join("\n\n");
  return <Context.Provider value={{enabled,activeSection,setActiveSection,registered,register,reviews, sent, update: (key, review) => setReviews(previous => {
    const next = {...previous};
    if (review) next[key] = review; else delete next[key];
    return next;
  })}}>
    {(changes.length>0 || sent) && <section id="answer-review" aria-label="Answer review" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-base font-bold">Answer review <span className={cn("ml-2 rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold", sent ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{sent ? "Sent" : "Unsaved draft"}</span></h2>
        <div className="flex flex-wrap gap-2 text-xs tabular-nums">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"><Check className="size-3"/>{entries.filter(r => r.status === "accepted").length} satisfied</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 ring-1 ring-rose-200 ring-inset dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30"><MessageSquare className="size-3"/>{changes.length} changes requested</span>
        </div>
      </div>
      {changes.length > 0 && !sent ? <form action={action} className="mt-4 space-y-3 border-t border-border pt-4">
        <input type="hidden" name="applicationId" value={applicationId}/>
        <label htmlFor="answer-review-message" className="text-sm font-medium">Request to applicant</label>
        <Textarea id="answer-review-message" name="message" value={message} readOnly rows={Math.min(10, changes.length * 3)} className="bg-muted/30"/>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={cn("text-xs tabular-nums",message.length > 2000 ? "text-destructive" : "text-muted-foreground")}>{message.length}/2000 characters</span>
          <SubmitButton disabled={changes.some(r => !r.note.trim()) || message.length > 2000 || message.length < 5} pendingText="Sending…">Send revision request</SubmitButton>
        </div>
      </form> : null}
      {state?.error ? <div role="alert" className="mt-3 text-sm text-destructive">{state.error}</div> : sent ? <div role="status" className="mt-3 text-sm font-medium text-primary">{state.emailSent === false ? "Revision request saved. Email not sent." : "Revision request sent."}</div> : null}
    </section>}
    {children}
  </Context.Provider>;
}

export function ReviewableAnswer({label, value, children, className}: {label: string; value?: string; children: ReactNode; className?: string}) {
  const context = useAnswerReview();
  const ref=useRef<HTMLDivElement>(null);
  const register=context?.register;
  const key = `${label}:${value ?? ""}`;
  useEffect(()=>{
    if(!register) return;
    const section=ref.current?.closest<HTMLElement>("[data-detail-section]")?.id ?? "other";
    register(key,{label,value,section});return ()=>register(key,null);
  },[register,key,label,value]);
  if (!context?.enabled) return <div ref={ref} data-review-answer className={className}>{children}</div>;
  const review = context.reviews[key];
  const changed = review?.status === "change";
  const accepted = review?.status === "accepted";
  return <div ref={ref} data-review-answer className={cn("relative min-w-0 rounded-lg border border-l-4 p-3 transition-colors", changed ? "col-span-full border-rose-300 border-l-rose-500 bg-rose-50/70 dark:border-rose-500/40 dark:bg-rose-500/10" : accepted ? "border-emerald-200 border-l-emerald-500 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-border border-l-slate-300 bg-card dark:border-l-slate-600",className)}>
    {accepted ? <span aria-hidden className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-3"/></span> : changed ? <span aria-hidden className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-rose-500 text-white"><MessageSquare className="size-3"/></span> : null}
    {children}
    <div data-answer-controls role="group" aria-label={`Review ${label}`} className="mt-3 flex flex-wrap gap-1.5">
      <Button type="button" size="sm" variant="outline" aria-label={`Mark ${label} satisfied`} title="Mark satisfied" aria-pressed={accepted} disabled={context.sent} onClick={()=>context.update(key,{label,value,status:"accepted",note:""})} className={cn("h-7 gap-1 px-2 text-xs font-semibold", accepted ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-300")}><Check className="size-3"/><span data-action-label> Satisfied</span></Button>
      <Button type="button" size="sm" variant="outline" aria-label={`Request change to ${label}`} title="Request change" aria-pressed={changed} disabled={context.sent} onClick={()=>context.update(key,{label,value,status:"change",note:review?.note ?? ""})} className={cn("h-7 gap-1 px-2 text-xs font-semibold", changed ? "border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:text-white" : "border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-500/40 dark:text-rose-300")}><MessageSquare className="size-3"/><span data-action-label> Request change</span></Button>
      {review && !context.sent ? <Button type="button" variant="ghost" size="sm" aria-label={`Reset review for ${label}`} onClick={()=>context.update(key)} className="h-7 px-2"><RotateCcw className="size-3"/></Button> : null}
    </div>
    {changed ? <div data-correction className="mt-3 space-y-1.5">
      <label className="block text-xs font-medium">Requested correction <span className="text-destructive">*</span>
        <Textarea aria-label={`Requested correction for ${label}`} value={review.note} disabled={context.sent} maxLength={600} onChange={e=>context.update(key,{...review,note:e.target.value})} placeholder="Revised figure or correction required" rows={2} className="mt-1.5 bg-card text-sm" required/>
      </label>
    </div> : null}
  </div>;
}
