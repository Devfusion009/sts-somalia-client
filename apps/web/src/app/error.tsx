"use client";

import { Button } from "@/components/ui/button";
import { RouteError, type RouteErrorProps } from "@/components/status/route-error";
import { rootOrigin } from "@/lib/subdomain";

export default function RootError(props: RouteErrorProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-secondary/30">
      <RouteError
        {...props}
        home={
          <Button size="lg" variant="outline" render={<a href={rootOrigin() || "/"} />}>
            Go to homepage
          </Button>
        }
      />
    </div>
  );
}
