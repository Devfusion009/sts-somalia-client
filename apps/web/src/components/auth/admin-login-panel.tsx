import Image from "next/image";
import { ShieldCheck, Headset, Phone, Mail, Ticket, Handshake, BookOpenCheck, Wallet } from "lucide-react";

const MODULES = [
  { code: "01", label: "Bookings & Orders", icon: Ticket },
  { code: "02", label: "Partners & Agencies", icon: Handshake },
  { code: "03", label: "Catalog & Inventory", icon: BookOpenCheck },
  { code: "04", label: "Finance & Payouts", icon: Wallet },
];

/**
 * Right-hand brand panel for the admin login split layout — same dark-teal
 * shell as AgentLoginBrandPanel, but the content is a manifest, not a hero
 * photo with an icon grid stacked on top of it. The HQ exterior
 * (public/about/office-building.webp) used to run full-bleed behind the
 * headline, which put the building's own "Sultaan Business Park" signage
 * directly behind our headline text — legible only by accident. It's now a
 * framed thumbnail next to its own address caption instead, so the photo
 * still proves this is a real office and the headline sits on solid ground.
 *
 * Modules are static (not links): unlike the agent panel's links into live
 * public pages, every admin route requires auth, so a pre-login "quick
 * link" here would just bounce back to this same screen. Listed as a
 * numbered manifest since they're literally the console's four sections,
 * not a decorative icon grid.
 */
export function AdminLoginBrandPanel() {
  return (
    <div className="relative isolate flex h-full w-full flex-col overflow-hidden rounded-3xl bg-sidebar px-9 py-9 text-sidebar-foreground shadow-2xl ring-1 ring-black/10 xl:px-12 xl:py-11">
      <div className="absolute -top-24 -right-24 size-72 rounded-full bg-sidebar-primary/20 blur-3xl" aria-hidden />

      <div className="relative z-10 flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/15">
          <ShieldCheck className="size-3.5 text-sidebar-primary" />
          ISO 9001:2015 Certified
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/15">
          <Headset className="size-3.5" />
          24/7 support
        </span>
      </div>

      <div className="relative z-10 mt-10">
        <p className="text-sm font-medium text-sidebar-primary">Admin console</p>
        <h1 className="mt-3 max-w-md font-heading text-3xl font-bold tracking-tight text-balance xl:text-[2.6rem] xl:leading-[1.05]">
          One console for every booking, partner, and payout.
        </h1>
      </div>

      <div className="relative z-10 mt-9 divide-y divide-white/10 border-y border-white/10">
        {MODULES.map(({ code, label, icon: Icon }) => (
          <div key={code} className="flex items-center gap-4 py-3.5">
            <span className="font-mono text-xs text-sidebar-foreground/40">{code}</span>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
              <Icon className="size-4" />
            </span>
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-auto flex items-end gap-4 pt-9">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
          <Image src="/about/office-building.webp" alt="" fill sizes="80px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Sultan Business Park</p>
          <p className="text-xs text-sidebar-foreground/60">Waaberi District, Mogadishu</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sidebar-foreground/60">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5" /> +252 611 444 420
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" /> info@scoutsts.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
