import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown in place of a portal page's primary content when the data it needs
 * comes from apps/api and that call failed — distinct from an empty state,
 * which would tell the user something false about their own bookings,
 * travelers, documents, or preferences.
 */
export function UnavailableNotice({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <p className="font-medium">{label} is temporarily unavailable</p>
        <p className="text-sm text-muted-foreground">Try again in a moment.</p>
      </CardContent>
    </Card>
  );
}
