import Link from "next/link";
import { ArrowRight, Circle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { AgencyOnboardingStatus } from "@/modules/agencies/queries";

const ITEMS: Array<{ key: keyof AgencyOnboardingStatus; label: string; description: string; href: string }> = [
  {
    key: "hasMarkupConfigured",
    label: "Set your markup rates",
    description: "Decide how much you add on top of net fares — this is your own pricing decision.",
    href: "/agent/markups",
  },
  {
    key: "hasFirstBooking",
    label: "Make your first booking",
    description: "Book a flight, hotel, visa, or Umrah package for a client.",
    href: "/agent/bookings",
  },
  {
    key: "hasInvitedTeamMember",
    label: "Invite a team member",
    description: "Give staff their own login and role-based access to the portal.",
    href: "/agent/team",
  },
];

/** Auto-collapses (renders nothing) once all three items are done — the caller doesn't need to gate this itself. */
export function OnboardingChecklist({ status }: { status: AgencyOnboardingStatus }) {
  if (ITEMS.every((item) => status[item.key])) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Getting started</CardTitle>
        <CardDescription>A few things to set up before you&apos;re fully up and running.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {ITEMS.map((item) => {
          const done = status[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-primary" />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              {!done ? <ArrowRight className="size-4 shrink-0 text-muted-foreground" /> : null}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
