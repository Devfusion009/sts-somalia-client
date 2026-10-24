"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "./status-screen";

export type RouteErrorProps = {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
};

/**
 * Body of every error.tsx boundary. `home` adds a way out for boundaries
 * that render without a portal shell or site header around them.
 */
export function RouteError({
  error,
  unstable_retry,
  reset,
  home,
}: RouteErrorProps & { home?: React.ReactNode }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <StatusScreen
      title="Something went wrong"
      reference={error.digest}
      actions={
        <>
          {home}
          {retry ? (
            <Button size="lg" onClick={() => retry()}>
              <RotateCcw data-icon="inline-start" aria-hidden />
              Try again
            </Button>
          ) : null}
        </>
      }
    />
  );
}
