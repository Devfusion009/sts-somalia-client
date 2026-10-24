import { PauseCircle, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";

/**
 * Full-screen notice shown in place of a partner-facing portal when the
 * account has been suspended (or offboarded) by STS admin — the entity's
 * status is flipped by the Partner Management Console's state machine, and
 * every portal layout gates on it so suspension actually revokes access
 * rather than only changing a badge on the admin side.
 */
export function PortalSuspendedNotice({ portalLabel }: { portalLabel: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center md:p-8">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
          >
            <PauseCircle className="size-5" />
          </span>
          <h1 className="font-heading text-base font-semibold">{portalLabel} access suspended</h1>
          <Button variant="outline" className="mt-1 max-sm:h-11" render={<a href={SUPPORT_PHONE_TEL} />}>
            <PhoneIcon aria-hidden="true" />
            <span className="tabular-nums">{SUPPORT_PHONE_DISPLAY}</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
