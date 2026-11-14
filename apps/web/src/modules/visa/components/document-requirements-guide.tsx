"use client";

import { DocumentGuideArt } from "./document-guide-art";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const GUIDES = {
  photo: {
    title: "Passport photo requirements",
    checks: ["Plain white background", "Face centred and fully visible", "Even lighting with no shadows", "Sharp image with natural colours"],
  },
  passport: {
    title: "Passport bio page requirements",
    checks: ["Full bio page in colour, with all edges visible", "Name, passport number and dates clearly readable", "Machine-readable lines fully visible", "No blur, glare, shadows or covered details"],
  },
} as const;

export function DocumentRequirementsGuide({ kind, description, maxMb }: { kind: keyof typeof GUIDES; description?: string | null; maxMb: number }) {
  const guide = GUIDES[kind];
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="link" size="sm" className="h-auto justify-start p-0 text-xs" />}>Document requirements</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{guide.title}</DialogTitle></DialogHeader>
        <DocumentGuideArt kind={kind} />
        {description ? <div className="text-sm font-medium">{description}</div> : null}
        <ul className="grid gap-3 text-sm sm:grid-cols-2">{guide.checks.map(check => <li key={check} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{check}</li>)}</ul>
        <div className="rounded-lg bg-muted px-4 py-3 text-xs font-medium text-muted-foreground">PDF, JPG or PNG · Maximum {maxMb} MB</div>
      </DialogContent>
    </Dialog>
  );
}
