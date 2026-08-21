import { Headset } from "lucide-react";
import { agencyWhatsappLink } from "@/lib/whatsapp";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Dedicated B2B support channel, distinct from the B2C floating WhatsApp
 * button (which only mounts in the (marketing) layout — agents never see
 * it). Prefills the chat with the agency name so support has context
 * immediately, without the agent needing to explain who they are.
 */
export function AgencySupportCard({ agencyName }: { agencyName: string }) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex items-center gap-3 pt-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Headset className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Agency Support</p>
          <p className="text-xs text-muted-foreground">
            Questions about bookings, your wallet, or your account — a dedicated line for agency
            partners, separate from customer support.
          </p>
        </div>
        <a
          href={agencyWhatsappLink(agencyName)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Chat with us
        </a>
      </CardContent>
    </Card>
  );
}
