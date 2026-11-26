"use client";

import type { ReactNode } from "react";
import { BriefcaseBusiness, UserRound, Settings2, CreditCard, Files, History, Check, MessageSquare, Layers } from "lucide-react";
import { useAnswerReview } from "./answer-review";
import styles from "./admin-review.module.css";

export function AdminReviewWorkspace({children}:{children:ReactNode}) {
  const review=useAnswerReview();
  return <div data-application-review data-active={review?.activeSection ?? "business"} className={styles.screen}>{children}</div>;
}
const icons=[BriefcaseBusiness,UserRound,Settings2,CreditCard,Files,History];
export function ReviewSectionTools() {
  const review=useAnswerReview();
  if(!review?.enabled) return null;
  return <div data-review-legend className="flex flex-wrap items-center gap-6 px-5 pt-5 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><Check size={16} aria-hidden/>Mark satisfied</span><span className="inline-flex items-center gap-2"><MessageSquare size={16} aria-hidden/>Request change</span></div>;
}
export function AdminReviewTabs({items}:{items:{id:string;label:string}[]}) {
  const review=useAnswerReview();
  return <nav aria-label="Application sections" className={styles.tabs}>{items.map((item,index)=>{
    const Icon=icons[index] ?? Files;
    return <button type="button" key={item.id} aria-current={review?.activeSection===item.id?"page":undefined} onClick={()=>review?.setActiveSection(item.id)}><Icon size={18} aria-hidden/>{item.label}</button>;
  })}</nav>;
}
export function AnswerSectionProgress({section}:{section?:string}) {
  const review=useAnswerReview();
  if(!review || !section) return null;
  const entries=Object.entries(review.registered).filter(([,r])=>r.section===section);
  if(!entries.length) return null;
  const count=entries.filter(([key])=>review.reviews[key]).length;
  return <div className="ml-auto flex items-center gap-3 text-xs font-normal text-muted-foreground"><span className="whitespace-nowrap">{count} of {entries.length} reviewed</span><progress aria-label="Answers reviewed" max={entries.length} value={count} className={styles.progress}/></div>;
}
export function AnswerReviewSummary() {
  const review=useAnswerReview();
  if(!review) return null;
  const entries=Object.entries(review.registered).filter(([,r])=>r.section===review.activeSection);
  const satisfied=entries.filter(([key])=>review.reviews[key]?.status==="accepted").length;
  const changes=entries.filter(([key])=>review.reviews[key]?.status==="change").length;
  return <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4">{[{Icon:Check,value:satisfied,label:"Satisfied"},{Icon:MessageSquare,value:changes,label:"Changes requested"},{Icon:Layers,value:Math.max(0,entries.length-satisfied-changes),label:"Remaining"}].map(({Icon,value,label})=><div key={label} className="rounded-lg border border-border bg-muted/30 px-2 py-3 text-center"><div className="flex items-center justify-center gap-2"><Icon size={16} aria-hidden/><span className="font-bold tabular-nums">{value}</span></div><div className="mt-1 text-xs leading-4 text-muted-foreground">{label}</div></div>)}</div>;
}
