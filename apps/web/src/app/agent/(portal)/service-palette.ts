import { BedDouble, PartyPopper, Plane, Stamp } from "lucide-react";
import { UmrahIcon } from "@/components/portal/umrah-icon";
import type { Database } from "@/lib/types/database.types";

type ItemType = Database["public"]["Enums"]["order_item_type"];

/** One colour and icon per product, shared by the launcher, booking table and booking mix. */
export const SERVICE_STYLE: Record<ItemType, { label: string; icon: typeof Plane; color: string }> = {
  flight: { label: "Flights", icon: Plane, color: "var(--chart-3)" },
  hotel: { label: "Hotels", icon: BedDouble, color: "var(--chart-1)" },
  visa: { label: "Visas", icon: Stamp, color: "var(--chart-4)" },
  umrah: { label: "Umrah", icon: UmrahIcon, color: "var(--chart-2)" },
  hall: { label: "Events & halls", icon: PartyPopper, color: "var(--chart-5)" },
};

export const SERVICE_ORDER: ItemType[] = ["flight", "hotel", "visa", "umrah", "hall"];
