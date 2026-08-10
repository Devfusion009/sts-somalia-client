import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { checkVisaRequirement, type VisaRequirementCategory } from "@/lib/provider-runtime/visa-check";

const CATEGORY_CLASS: Record<VisaRequirementCategory, string> = {
  visa_free_access: "bg-primary/10 text-primary",
  visa_on_arrival: "bg-chart-3/10 text-chart-3",
  eta: "bg-chart-3/10 text-chart-3",
  visa_online: "bg-brand-gold/15 text-brand-gold",
  visa_required: "bg-muted text-muted-foreground",
  unknown: "",
};

/**
 * Live "for Somali passport holders" visa-requirement lookup, shown next to
 * a destination's visa product listing when the Zylalabs integration is
 * active in /admin/integrations. Silently renders nothing when the
 * integration is off or the destination isn't recognized — this is an
 * informational enrichment, never a blocker for applying.
 */
export async function VisaRequirementBadge({ destinationCountryName }: { destinationCountryName: string }) {
  const result = await checkVisaRequirement({ nationality: "Somalia", destinationCountry: destinationCountryName });
  if (!result.enabled || result.category === "unknown") return null;

  return (
    <Badge variant="outline" className={`gap-1 border-transparent font-normal ${CATEGORY_CLASS[result.category]}`}>
      <Globe className="size-3" />
      {result.label} for Somali passports
    </Badge>
  );
}
