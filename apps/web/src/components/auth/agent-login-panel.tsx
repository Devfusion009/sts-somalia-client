import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Headset, Plane, BedDouble, FileCheck2, MoonStar, ShieldCheck, Users } from "lucide-react";

const SERVICES = [
  {
    href: "/flights",
    label: "Flights",
    icon: Plane,
  },
  {
    href: "/hotels",
    label: "Hotels",
    icon: BedDouble,
  },
  {
    href: "/visa",
    label: "Visas",
    icon: FileCheck2,
  },
  {
    href: "/umrah",
    label: "Umrah",
    icon: MoonStar,
  },
  {
    href: "/agent/bookings",
    label: "My bookings",
    icon: Users,
  },
];

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
    <div className="flex h-full flex-col bg-background">
      {/* Photo band with the diagonal teal wash bleeding in from the top-left,
          matching the header strip's angle instead of a flat overlay. */}
      <div className="relative isolate min-h-[22rem] flex-1 overflow-hidden">
        <Image
          src="/about/desk-credentials.webp"
          alt="STS Somalia office — agent desk"
          fill
          priority
          sizes="60vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar/70 to-transparent"
          style={{ clipPath: "polygon(0 0, 62% 0, 22% 100%, 0 100%)" }}
          aria-hidden
        />

        <div className="relative z-10 flex items-start justify-between p-6 xl:p-8">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-white">
            <ShieldCheck aria-hidden className="size-4 text-sidebar-primary" />
            ISO 9001:2015 Certified Travel Agency
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
            <Headset aria-hidden className="size-4" />
            24/7 support
          </span>
        </div>

        <div className="relative z-10 max-w-md px-6 xl:px-8">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-balance text-white xl:text-[2.5rem] xl:leading-[1.1]">
            Travel with <span className="text-sidebar-primary">confidence</span>, discover with{" "}
            <span className="text-brand-accent">Scout</span>.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            One desk for flights, hotels, visas, and Umrah — agency pricing, real-time tracking, and
            a team that handles the paperwork.
          </p>
        </div>
      </div>

      {/* Service cards, overlapping the photo's bottom edge slightly for depth. */}
      <div className="relative z-10 -mt-8 px-6 xl:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {SERVICES.map((service) => (
            <Link
              key={service.href}
              href={service.href}
              className="group flex items-center gap-3 rounded-2xl bg-card p-4 shadow-lg ring-1 ring-border outline-none transition-shadow duration-200 hover:shadow-xl focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <service.icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold">{service.label}</span>
              <ArrowRight
                aria-hidden
                className="size-3.5 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </Link>
          ))}
        </div>
      </div>

      <div className="h-6 xl:h-8" aria-hidden />
    </div>
  );
}
