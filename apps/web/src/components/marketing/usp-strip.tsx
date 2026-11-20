import { BadgeCheck, Headset, MapPin, Wallet } from "lucide-react";

const ITEMS = [
  { Icon: BadgeCheck, title: "ISO 9001:2015", detail: "Certified quality system" },
  { Icon: Headset, title: "Local support", detail: "Somali, English & Arabic" },
  { Icon: Wallet, title: "Payment options", detail: "Mobile money, bank & card" },
  { Icon: MapPin, title: "Two offices", detail: "Mogadishu & Nairobi" },
];

export function UspStrip() {
  return <div className="border-b border-border bg-card">
    <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-4 py-7 sm:px-6 lg:grid-cols-4 lg:px-8">
      {ITEMS.map(({ Icon, title, detail }) => <li key={title} className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-5" aria-hidden /></span>
        <div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p></div>
      </li>)}
    </ul>
  </div>;
}
