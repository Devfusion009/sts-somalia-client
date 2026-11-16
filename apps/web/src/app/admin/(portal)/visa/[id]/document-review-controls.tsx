"use client";

import { useState } from "react";
import { AlertCircle, Check, CheckCircle2, ClipboardCheck, ExternalLink, FileText, RotateCcw, X } from "lucide-react";
import { useCaseActionState } from "@/modules/visa/components/use-case-action-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import { adminReviewDocument } from "@/modules/visa/admin-actions";

type Check = { key: string; label: string };
type Verdict = "pass" | "fail" | null;

export function DocumentReviewControls({ documentId, applicationId, reviewStatus, label, checklist, fileName, fileSizeLabel }: {
  documentId: string; applicationId: string; reviewStatus: string; label: string; checklist: Check[];
  fileName?: string; fileSizeLabel?: string;
}) {
  const [state, action, pending] = useCaseActionState(adminReviewDocument, null);
  const [open, setOpen] = useState(false);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState(false);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  const passed = checklist.filter(check => verdicts[check.key] === "pass").length;
  const failed = checklist.filter(check => verdicts[check.key] === "fail").length;
  const checked = passed + failed;
  const remaining = checklist.length - checked;
  const verified = reviewStatus === "accepted" && !correction;
  const replacing = failed > 0 || correction || reviewStatus === "rejected";
  const locked = pending || Boolean(state?.requiresRefresh);
  const canAccept = reviewStatus === "pending" && remaining === 0 && failed === 0;
  const canReject = reviewStatus !== "rejected" && (failed > 0 || reason.trim().length >= 3);
  const status = verified ? "Document verified" : failed ? `${failed} ${failed === 1 ? "issue" : "issues"} flagged` : remaining ? `${remaining} ${remaining === 1 ? "check" : "checks"} remaining` : correction ? "Replacement review" : "Ready to verify";
  const changeOpen = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next && reviewStatus === "accepted") { setCorrection(false); setVerdicts({}); setReason(""); }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <ClipboardCheck data-icon="inline-start" />{reviewStatus === "accepted" ? "Review decision" : "Review"}
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[740px]">
        <DialogHeader className="border-b border-border px-5 py-5 pr-12 sm:px-7">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Document review</span>
          <DialogTitle className="text-base leading-snug first-letter:uppercase sm:text-lg">{label}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex min-h-0 flex-col overflow-hidden">
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <input type="hidden" name="decision" value={replacing ? "reject" : "accept"} />
          <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-primary"><FileText className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold" title={fileName}>{fileName || "Application document"}</span><span className="mt-0.5 block text-xs text-muted-foreground">{fileSizeLabel ? `${fileSizeLabel} · ` : ""}{reviewStatus === "accepted" ? "Verified" : reviewStatus === "rejected" ? "Replacement requested" : "Awaiting review"}</span></div>
              <Button size="sm" variant="outline" render={<a href={`/api/visa/documents/${documentId}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label} in a new tab`} />}><ExternalLink className="size-4" aria-hidden="true" />Open document</Button>
            </div>

            {verified ? <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5 text-primary"><CheckCircle2 className="size-6 shrink-0" aria-hidden="true" /><span className="font-semibold">Document verified</span></div> : <>
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Verification checklist</h3><span className="text-xs text-muted-foreground tabular-nums">{checked} of {checklist.length} checked</span></div>
                <progress aria-label="Checklist completion" max={Math.max(checklist.length, 1)} value={checked} className="block h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
              </div>
              <ol className="space-y-2">
                {checklist.map((check, index) => {
                  const selected = verdicts[check.key];
                  return <li key={check.key} className={cn("rounded-xl border p-3 transition-colors sm:p-3.5", selected === "fail" ? "border-destructive/25 bg-destructive/5" : selected === "pass" ? "border-primary/20 bg-primary/[0.035]" : "border-border bg-card")}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex min-w-0 flex-1 items-start gap-3"><span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold tabular-nums", selected === "fail" ? "bg-destructive/10 text-destructive" : selected === "pass" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{selected === "pass" ? <Check className="size-3.5" aria-hidden="true" /> : selected === "fail" ? <X className="size-3.5" aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span><span className="pt-0.5 text-sm leading-relaxed">{check.label}</span></span>
                      {selected ? <input type="hidden" name={`check:${check.key}`} value={selected} /> : null}
                      <div role="group" aria-label={check.label} className="flex shrink-0 gap-1.5 self-end rounded-lg bg-muted/60 p-1 sm:self-auto">
                        {(["pass", "fail"] as const).map(value => <button key={value} type="button" disabled={locked} aria-pressed={selected === value} aria-label={`${value === "pass" ? "Pass" : "Fail"}: ${check.label}`} onClick={() => setVerdicts(previous => ({ ...previous, [check.key]: selected === value ? null : value }))} className={cn("inline-flex min-h-9 min-w-[72px] items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50", selected === value ? value === "pass" ? "border-primary bg-primary text-primary-foreground shadow-xs" : "border-destructive bg-destructive text-white shadow-xs" : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground")}>
                          {value === "pass" ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}{value === "pass" ? "Pass" : "Fail"}
                        </button>)}
                      </div>
                    </div>
                  </li>;
                })}
              </ol>
            </>}

            {replacing ? <Field><FieldLabel htmlFor={`reason-${documentId}`}>Correction requested{failed ? " (optional note)" : " *"}</FieldLabel><Textarea id={`reason-${documentId}`} name="reason" value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={2000} disabled={locked} required={!failed} minLength={failed ? undefined : 3} placeholder="Describe what the applicant needs to correct" /></Field> : null}
            {state?.error ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{state.error}</div> : null}
            {state?.requiresRefresh ? <Button type="button" variant="outline" onClick={() => window.location.reload()}>Check saved status</Button> : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:px-7">
            <div role="status" aria-live="polite" className={cn("flex items-center gap-2 text-xs font-medium", failed ? "text-destructive" : verified || canAccept ? "text-primary" : "text-muted-foreground")}>
              {verified || canAccept ? <CheckCircle2 className="size-4" aria-hidden="true" /> : failed ? <AlertCircle className="size-4" aria-hidden="true" /> : <ClipboardCheck className="size-4" aria-hidden="true" />}{status}
            </div>
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>{verified ? "Close" : "Cancel"}</Button>
              {verified ? <Button type="button" variant="outline" disabled={locked} onClick={() => setCorrection(true)}><RotateCcw className="size-4" aria-hidden="true" />Request replacement</Button> : replacing ? <SubmitButton variant="destructive" pendingText="Requesting…" disabled={locked || !canReject}>Request replacement</SubmitButton> : <SubmitButton pendingText="Verifying…" disabled={locked || !canAccept}><CheckCircle2 className="size-4" aria-hidden="true" />Verify document</SubmitButton>}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
