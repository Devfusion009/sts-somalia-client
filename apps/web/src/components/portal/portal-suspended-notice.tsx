import { PauseCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <PauseCircle className="size-6" />
          </div>
          <p className="font-medium">Your {portalLabel} access is suspended</p>
          <p className="text-sm text-muted-foreground">
            This partner account has been suspended by STS Somalia. If you believe this is a mistake, or to resolve
            it, please contact the STS partnerships team.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
