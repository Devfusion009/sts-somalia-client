import { Building2 } from "lucide-react";
import { hotelLogoUrl } from "@/modules/hotels/images";
import { cn } from "@/lib/utils";

/** The hotel's uploaded brand mark in a square tile; a building icon when none is set. */
export function HotelLogo({ path, className }: { path: string | null; className?: string }) {
  const url = hotelLogoUrl(path);
  return (
    <span
      className={cn(
        "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-foreground/10",
        className
      )}
    >
      {url ? (
        // Supabase Storage URL; next/image would need the host allow-listed.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-contain p-1" />
      ) : (
        <Building2 className="size-6 text-muted-foreground" />
      )}
    </span>
  );
}
