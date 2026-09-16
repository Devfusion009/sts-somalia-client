import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Headset, Plane, BedDouble, FileCheck2, MoonStar, ShieldCheck, Users } from "lucide-react";

const SERVICES = [
  {
    href: "/flights",
    label: "Flight Booking",
    caption: "Search and book flights for your clients",
    icon: Plane,
  },
  {
    href: "/hotels",
    label: "Hotel Booking",
    caption: "Find and book hotels worldwide",
    icon: BedDouble,
  },
  {
    href: "/visa",
    label: "Visa Management",
    caption: "Apply and track visa applications",
    icon: FileCheck2,
  },
  {
    href: "/umrah",
    label: "Umrah Packages",
    caption: "Book Umrah packages for your customers",
    icon: MoonStar,
  },
  {
    href: "/agent/bookings",
    label: "My Bookings",
    caption: "View and manage your bookings",
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
            <ShieldCheck className="size-4 text-sidebar-primary" />
            ISO 9001:2015 Certified Travel Agency
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
            <Headset className="size-4" />
            24/7 Support
          </span>
        </div>

        <div className="relative z-10 max-w-md px-6 xl:px-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance text-white xl:text-[2.5rem] xl:leading-[1.1]">
            Travel with <span className="text-sidebar-primary">confidence</span>, discover with{" "}
            <span className="text-brand-accent">Scout</span>.
          </h1>
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
              className="group flex flex-col items-start gap-2.5 rounded-2xl bg-card p-4 shadow-lg ring-1 ring-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <service.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold">{service.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{service.caption}</p>
              </div>
              <ArrowRight className="size-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </div>

      <div className="h-6 xl:h-8" aria-hidden />
    </div>
  );
}
