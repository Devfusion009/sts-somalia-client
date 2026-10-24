import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "./status-screen";

/** 404 body for segment-level not-found.tsx files, rendered inside the portal shell or site chrome. */
export function NotFoundScreen({ href, label }: { href: string; label: string }) {
  return (
    <StatusScreen
      code="404"
      title="Page not found"
      actions={
        <Button size="lg" variant="outline" render={<a href={href} />}>
          <ArrowLeft data-icon="inline-start" aria-hidden />
          {label}
        </Button>
      }
    />
  );
}
