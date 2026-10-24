import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/**
 * Shown in place of a portal page's primary content when the data it needs
 * comes from apps/api and that call failed — distinct from an empty state,
 * which would tell the user something false about their own bookings,
 * travelers, documents, or preferences.
 */
export function UnavailableNotice({ label }: { label: string }) {
  return (
    <Card role="alert">
      <Empty>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <AlertTriangle />
        </EmptyMedia>
        <EmptyTitle>{label} is temporarily unavailable</EmptyTitle>
      </Empty>
    </Card>
  );
}
