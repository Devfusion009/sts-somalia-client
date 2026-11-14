"use client";
import { useState } from "react";
import { Download, FileText, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function EmailDraftComposer({ applicationId, subject, body, blocker, documents }: { applicationId: string; subject: string; body: string; blocker: string | null; documents: { id: string; name: string; label: string; status: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [gmail, setGmail] = useState<string | null>(null);
  async function download(form: FormData) {
    if (pending) return;
    setError(null); setPending(true);
    try {
      const response = await fetch(`/api/visa/${applicationId}/submission-email`, { method: "POST", body: form, signal: AbortSignal.timeout(120000) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "The email draft could not be generated."); }
      if (!response.headers.get("content-type")?.includes("application/zip")) throw new Error("Sign in again and refresh before preparing the submission.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `visa-${applicationId}-submission.zip`; link.click();
      const compose = new URL("https://mail.google.com/mail/");
      compose.search = new URLSearchParams({ view: "cm", fs: "1", to: String(form.get("email")), su: String(form.get("subject")), body: `${String(form.get("body"))}\n\nVisa office: ${String(form.get("officeName"))}\nOffice phone: ${String(form.get("phone"))}` }).toString();
      setGmail(compose.toString());
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The email draft could not be generated."); }
    finally { setPending(false); }
  }
  return <form onSubmit={event => { event.preventDefault(); void download(new FormData(event.currentTarget)); }} onChange={() => setGmail(null)} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">Visa office</h2>
      <div className="space-y-2"><Label htmlFor="office-name">Office name *</Label><Input id="office-name" name="officeName" required maxLength={160} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="office-email">Email *</Label><Input id="office-email" type="email" name="email" required maxLength={254} /></div>
        <div className="space-y-2"><Label htmlFor="office-phone">Phone *</Label><Input id="office-phone" type="tel" name="phone" required maxLength={40} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="email-subject">Subject *</Label><Input id="email-subject" name="subject" required maxLength={300} defaultValue={subject} /></div>
      <div className="space-y-2"><Label htmlFor="email-body">Message *</Label><Textarea id="email-body" name="body" rows={24} required maxLength={50000} defaultValue={body} className="text-sm leading-relaxed" /></div>
      {blocker || error ? <div role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{blocker || error}</div> : null}
      <Button type="submit" loading={pending} disabled={pending || Boolean(blocker)}><Download className="size-4" />{pending ? "Preparing attachments…" : "1. Download submission pack"}</Button>
      {gmail ? <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <a href={gmail} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><ExternalLink className="size-4" />2. Open Gmail draft</a>
        <div className="text-sm">Attach the downloaded submission pack, or its documents folder, in Gmail before sending.</div>
      </div> : null}
      <div className="text-xs text-muted-foreground">The pack includes every listed document, the application summary and email text. Gmail opens with the recipient and message filled; attachments must be added in Gmail. Record submission after sending.</div>
    </section>
    <aside className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-base font-semibold">Attachments ({documents.length})</h2>
      <ul className="divide-y divide-border">{documents.map(doc => <li key={doc.id} className="py-3 text-sm"><a href={`/api/visa/documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 font-medium text-primary underline-offset-4 hover:underline"><FileText className="mt-0.5 size-4 shrink-0" />{doc.label}</a><div className="mt-1 break-words text-xs text-muted-foreground">{doc.name} · {doc.status === "accepted" ? "Verified" : "Not verified"}</div></li>)}</ul>
    </aside>
  </form>;
}
