import { Headset } from "lucide-react";
import { agencyWhatsappLink } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Dedicated B2B support channel, distinct from the B2C floating WhatsApp
 * button (which only mounts in the (marketing) layout — agents never see
 * it). Prefills the chat with the agency name so support has context
 * immediately, without the agent needing to explain who they are.
 */
export function AgencySupportCard({ agencyName }: { agencyName: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        >
          <Headset className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium">Agency support</p>
        <Button
          variant="outline"
          className="shrink-0"
          nativeButton={false}
          render={<a href={agencyWhatsappLink(agencyName)} target="_blank" rel="noopener noreferrer" />}
        >
          Chat on WhatsApp
        </Button>
      </CardContent>
    </Card>
  );
}
