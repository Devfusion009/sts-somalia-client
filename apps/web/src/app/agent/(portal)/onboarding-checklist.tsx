import Link from "next/link";
import { ChevronRight, Circle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgencyOnboardingStatus } from "@/modules/agencies/queries";

const ITEMS: Array<{ key: keyof AgencyOnboardingStatus; label: string; href: string }> = [
  { key: "hasMarkupConfigured", label: "Set your markup rates", href: "/agent/markups" },
  { key: "hasFirstBooking", label: "Make your first booking", href: "/agent/book" },
  { key: "hasInvitedTeamMember", label: "Invite a team member", href: "/agent/team" },
];

/** Auto-collapses (renders nothing) once all three items are done — the caller doesn't need to gate this itself. */
export function OnboardingChecklist({ status }: { status: AgencyOnboardingStatus }) {
  if (ITEMS.every((item) => status[item.key])) return null;
  const done = ITEMS.filter((item) => status[item.key]).length;

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-3">
        <CardTitle>Getting started</CardTitle>
        <CardAction>
          <Badge variant="neutral" className="tabular-nums">
            {done} of {ITEMS.length}
          </Badge>
        </CardAction>
      </CardHeader>
      <ul className="divide-y divide-border border-t border-border">
        {ITEMS.map((item) => {
          const complete = status[item.key];
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                {complete ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className={cn("min-w-0 flex-1", complete ? "text-muted-foreground line-through" : "font-medium")}>
                  {item.label}
                  <span className="sr-only">{complete ? " (done)" : " (to do)"}</span>
                </span>
                {!complete ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
