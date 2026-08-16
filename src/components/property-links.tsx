import { Globe, MapPin, MessageCircle, Link2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PropertyLink = { label: string; url: string };

// lucide-react dropped brand marks (Facebook/Instagram/etc.) for trademark
// reasons — this maps common link labels to a neutral icon rather than
// leaving unrecognized ones with no icon at all.
const ICON_BY_LABEL: Record<string, LucideIcon> = {
  website: Globe,
  whatsapp: MessageCircle,
  "google maps": MapPin,
  maps: MapPin,
};

function iconFor(label: string): LucideIcon {
  return ICON_BY_LABEL[label.trim().toLowerCase()] ?? Link2;
}

/** Outbound links only — never the source of the property's own photos/reviews, see property-reviews.tsx. */
export function PropertyLinks({ links, className }: { links: PropertyLink[]; className?: string }) {
  if (links.length === 0) return null;
  const sorted = [...links].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {sorted.map((link) => {
        const Icon = iconFor(link.label);
        return (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Icon className="size-3.5" />
            {link.label}
          </a>
        );
      })}
    </div>
  );
}
