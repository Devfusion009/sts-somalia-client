import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Headset, Phone, Mail, MapPin, Plane, BedDouble, FileCheck2, MoonStar } from "lucide-react";

const QUICK_LINKS = [
  { href: "/flights", label: "Flights", icon: Plane, tint: "bg-sky-400/15 text-sky-300" },
  { href: "/hotels", label: "Hotels", icon: BedDouble, tint: "bg-amber-400/15 text-amber-300" },
  { href: "/visa", label: "Visa", icon: FileCheck2, tint: "bg-violet-400/15 text-violet-300" },
  { href: "/umrah", label: "Umrah", icon: MoonStar, tint: "bg-rose-400/15 text-rose-300" },
];

const DOT_GRID = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
};

/**
 * Right-hand brand panel for the agent login split layout. Photo is the
 * client's own Mogadishu office desk (public/about/desk-credentials.webp) —
 * same asset used on the About page's credentials wall, not stock art.
 *
 * Deliberately no scroll-triggered motion (FadeIn/StaggerGroup): this whole
 * panel is above the fold with nothing to scroll, so a whileInView reveal
 * would just be content sitting at opacity:0 until Framer hydrates and its
 * observer fires — a real flash-of-missing-content risk on a login page, and
 * permanently invisible with JS disabled.
 */
export function AgentLoginBrandPanel() {
  return (
    <div className="relative isolate flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl bg-sidebar px-9 py-9 text-sidebar-foreground shadow-2xl ring-1 ring-black/10 xl:px-12 xl:py-11">
      <Image
        src="/about/desk-credentials.webp"
        alt=""
        fill
        priority
        sizes="50vw"
        className="object-cover opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-sidebar/85 via-sidebar/20 to-sidebar/50" aria-hidden />
      <div className="absolute inset-0 opacity-[0.06]" style={DOT_GRID} aria-hidden />
      <div className="absolute -top-16 -right-16 size-72 rounded-full bg-sidebar-primary/30 blur-3xl" aria-hidden />

      <div className="relative z-10 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/15 backdrop-blur-sm">
          <ShieldCheck className="size-3.5 text-sidebar-primary" />
          ISO 9001:2015 Certified
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/15 backdrop-blur-sm">
          <Headset className="size-3.5" />
          24/7 Support
        </span>
      </div>

      <div className="relative z-10">
        <p className="text-xs font-semibold tracking-[0.2em] text-sidebar-primary uppercase">Agent Portal</p>
        <h1 className="mt-3 max-w-md font-heading text-3xl font-bold tracking-tight text-balance xl:text-[2.6rem] xl:leading-[1.05]">
          One desk for flights, hotels, visas, and Umrah.
        </h1>

        <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {QUICK_LINKS.map(({ href, label, icon: Icon, tint }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-3 ring-1 ring-white/10 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tint}`}>
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-xs text-sidebar-foreground/75">
        <span className="inline-flex items-center gap-1.5">
          <Phone className="size-3.5" /> +252 611 444 420
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Mail className="size-3.5" /> info@scoutsts.com
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" /> Sultan Business Park, Waaberi District, Mogadishu
        </span>
      </div>
    </div>
  );
}
