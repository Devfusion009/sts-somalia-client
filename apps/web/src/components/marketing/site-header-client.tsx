"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/auth/actions";
import { portalHref } from "@/lib/subdomain";
import type { PartnerContext } from "@/modules/identity/queries";
import { MEGA_SECTIONS, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL, type MegaSection } from "@/lib/marketing-nav";
import { cn } from "@/lib/utils";
import { createScrollFlagStore } from "@/lib/scroll-flag-store";
import type { Database } from "@/lib/types/database.types";

import { ArrowForwardIcon, ArticleIcon, CelebrationIcon, DashboardIcon, ExpandMoreIcon, FlightTakeoffIcon, HotelIcon, LogoutIcon, MenuIcon, MosqueIcon, NearMeIcon, PersonIcon, PlaceIcon, SearchIcon } from "@/components/ui/mui-icons";
import type { SvgIconComponent } from "@/components/ui/mui-icons";
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const ICONS: Record<MegaSection["icon"], SvgIconComponent> = {
  flight: FlightTakeoffIcon,
  hotel: HotelIcon,
  visa: ArticleIcon,
  umrah: MosqueIcon,
  events: CelebrationIcon,
};

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email || "?";
  return source
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Pill-shaped primary nav with hover mega-menus, matching the reference
 * layout. Partner/acquisition links stay out of this consumer nav (they live
 * in the footer) — the one exception is the portal switch, which only appears
 * for an account that already holds that identity.
 */
export function SiteHeaderClient({ profile, contexts }: { profile: Profile | null; contexts: PartnerContext[] }) {
  const pathname = usePathname();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover intent: a small close delay stops the panel flickering while the
  // pointer crosses the gap between the pill and the panel below it.
  const open = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenKey(key);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenKey(null), 140);
  };

  // Closing on navigation is done in the links' onClick rather than an effect
  // on `pathname` — an effect would setState synchronously on every route
  // change, and the click is the actual event we care about.
  const closeNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenKey(null);
  };

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <>
      {/* ---------------- Desktop pill nav ---------------- */}
      <nav aria-label="Primary" data-nav-loader className="hidden items-center gap-2 lg:flex" onMouseLeave={scheduleClose}>
        {MEGA_SECTIONS.map((section) => {
          const Icon = ICONS[section.icon];
          const active = pathname.startsWith(section.href);
          const isOpen = openKey === section.key;

          return (
            <div
              key={section.key}
              className="relative"
              onMouseEnter={() => open(section.key)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeNow();
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose();
              }}
            >
              <Link
                href={section.href}
                aria-expanded={isOpen}
                onFocus={() => open(section.key)}
                onClick={closeNow}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all duration-300 ease-out group-data-[condensed]/header:h-9 group-data-[condensed]/header:px-3.5 group-data-[condensed]/header:text-[13px]",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  active || isOpen
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                )}
              >
                <Icon sx={{ fontSize: 19 }} aria-hidden />
                {section.label}
                <ExpandMoreIcon
                  sx={{ fontSize: 16 }}
                  className={cn("transition-transform duration-200", isOpen && "rotate-180")}
                />
              </Link>

              <AnimatePresence>
                {isOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute top-full left-1/2 z-50 w-max -translate-x-1/2 pt-3"
                  >
                    <div className="overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
                      <div className="flex items-start gap-3 border-b border-border bg-secondary/50 p-4">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                          <Icon sx={{ fontSize: 20 }} />
                        </span>
                        <div className="max-w-xs">
                          <Link
                            href={section.href}
                            onClick={closeNow}
                            className="flex items-center gap-1.5 font-heading text-sm font-bold hover:text-primary"
                          >
                            All {section.label}
                            <ArrowForwardIcon sx={{ fontSize: 14 }} className="text-primary" />
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">{section.blurb}</p>
                        </div>
                      </div>
                      <div className="flex gap-8 p-4">
                        {section.columns.map((column) => (
                          <div key={column.heading} className="min-w-44">
                            <p className="mb-2 text-xs font-bold text-muted-foreground">
                              {column.heading}
                            </p>
                            <ul className="space-y-0.5">
                              {column.links.map((link) => (
                                <li key={link.href + link.label}>
                                  <Link
                                    href={link.href}
                                    onClick={closeNow}
                                    className="block rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-primary focus-visible:bg-accent focus-visible:text-primary"
                                  >
                                    {link.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* ---------------- Desktop right cluster ---------------- */}
      <div className="hidden items-center gap-2 lg:flex">
        {profile ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="group/user flex h-11 items-center gap-2.5 rounded-full border border-border/70 bg-white/70 py-1 pr-3 pl-1 shadow-sm backdrop-blur transition-all duration-300 ease-out hover:border-primary/40 hover:bg-white hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none group-data-[condensed]/header:h-9"
                />
              }
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-teal-700 text-xs font-bold text-white ring-2 ring-white group-data-[condensed]/header:size-7">
                {initials(profile.full_name, profile.email)}
              </span>
              <span className="max-w-28 truncate text-sm font-semibold">{profile.full_name || "My Account"}</span>
              <ExpandMoreIcon sx={{ fontSize: 18 }} className="text-muted-foreground transition-transform duration-200 group-aria-expanded/user:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-72 overflow-hidden rounded-2xl border border-border/60 p-0 shadow-2xl shadow-black/15 ring-0">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#06312f] via-[#0a4a45] to-primary px-4 pt-4 pb-4 text-white">
                <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-brand-accent/25 blur-2xl" aria-hidden />
                <div className="relative flex items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15 text-base font-bold ring-2 ring-white/40 backdrop-blur">
                    {initials(profile.full_name, profile.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base leading-tight font-bold">{profile.full_name || "My Account"}</p>
                    <p className="truncate text-xs text-white/75">{profile.email}</p>
                  </div>
                </div>
                <span className="relative mt-3 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-xs font-medium">
                  {profile.is_platform_admin ? "Administrator" : "Personal account"}
                </span>
              </div>

              <div className="p-1.5">
                {profile.role !== "agent" ? (
                  <>
                    <MenuLink href="/account" icon={<PersonIcon sx={{ fontSize: 18 }} />} label="My Account" />
                    <MenuLink href="/account/bookings" icon={<FlightTakeoffIcon sx={{ fontSize: 18 }} />} label="My Bookings" />
                    <MenuLink href="/account/visa" icon={<ArticleIcon sx={{ fontSize: 18 }} />} label="Visa Applications" />
                  </>
                ) : null}
                {profile?.is_platform_admin ? (
                  <MenuLink href={portalHref("admin")} icon={<DashboardIcon sx={{ fontSize: 18 }} />} label="Admin Console" />
                ) : null}
                {contexts.length > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-2.5 text-xs">Switch account</DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {contexts.map((c) => (
                      <DropdownMenuItem key={c.type} render={<Link href={c.href} />} className="gap-3 rounded-xl px-2.5 py-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-accent/10 text-brand-accent">
                          <DashboardIcon sx={{ fontSize: 18 }} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {c.name} <span className="text-muted-foreground">· {c.label}</span>
                        </span>
                        {c.status && c.status !== "live" ? (
                          <span className="shrink-0 text-xs text-muted-foreground capitalize">{c.status}</span>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
              </div>

              <div className="border-t border-border/60 bg-muted/40 p-1.5">
                <form action={signOutAction}>
                  <DropdownMenuItem variant="destructive" render={<button type="submit" className="w-full" />} className="gap-3 rounded-xl px-2.5 py-2 font-semibold">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10">
                      <LogoutIcon sx={{ fontSize: 18 }} />
                    </span>
                    Sign out
                  </DropdownMenuItem>
                </form>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            render={<Link href="/login" />}
            className="h-11 rounded-full border-brand-accent px-5 font-semibold text-brand-accent transition-all duration-300 ease-out group-data-[condensed]/header:h-9 group-data-[condensed]/header:px-4 hover:bg-brand-accent hover:text-brand-accent-foreground dark:border-brand-accent dark:bg-transparent"
          >
            Log in
          </Button>
        )}

        <Button
          render={<Link href="/#plan" />}
          className="h-11 gap-2 rounded-full bg-brand-accent px-5 font-semibold text-brand-accent-foreground transition-all duration-300 ease-out group-data-[condensed]/header:h-9 group-data-[condensed]/header:px-4 hover:bg-brand-accent/90"
        >
          <NearMeIcon sx={{ fontSize: 18 }} />
          Plan My Trip
        </Button>
      </div>

      {/* ---------------- Mobile ---------------- */}
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Open menu" className="size-11 rounded-full transition-[width,height] duration-300 ease-out group-data-[condensed]/header:size-9 lg:hidden" />
          }
        >
          <MenuIcon />
        </SheetTrigger>
        <SheetContent side="right" className="flex w-80 flex-col">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <nav data-nav-loader className="flex flex-col gap-5">
              {MEGA_SECTIONS.map((section) => {
                const Icon = ICONS[section.icon];
                return (
                  <div key={section.key}>
                    <SheetClose
                      render={
                        <Link
                          href={section.href}
                          className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-2 font-heading text-base font-semibold hover:bg-accent"
                        />
                      }
                    >
                      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon sx={{ fontSize: 18 }} />
                      </span>
                      {section.label}
                    </SheetClose>
                    <div className="mt-1 ml-6 flex flex-col border-l border-border pl-5">
                      {section.columns[0]?.links.slice(0, 4).map((link) => (
                        <SheetClose
                          key={link.href + link.label}
                          render={
                            <Link
                              href={link.href}
                              className="flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                            />
                          }
                        >
                          {link.label}
                        </SheetClose>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-border pt-4">
              {profile ? (
                <div className="flex flex-col gap-1">
                  {profile.role !== "agent" ? (
                    <SheetClose render={<Link href="/account" className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-accent" />}>
                      My Account
                    </SheetClose>
                  ) : null}
                  {profile?.is_platform_admin ? (
                    <SheetClose render={<Link href={portalHref("admin")} className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-accent" />}>
                      Admin Console
                    </SheetClose>
                  ) : null}
                  {contexts.length > 0 ? (
                    <>
                      <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">Switch account</p>
                      {contexts.map((c) => (
                        <SheetClose
                          key={c.type}
                          render={<Link href={c.href} className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-accent" />}
                        >
                          {c.name} · {c.label}
                          {c.status && c.status !== "live" ? (
                            <span className="ml-1 text-xs text-muted-foreground capitalize">({c.status})</span>
                          ) : null}
                        </SheetClose>
                      ))}
                    </>
                  ) : null}
                  <form action={signOutAction}>
                    <button type="submit" className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium text-destructive hover:bg-accent">
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button variant="outline" render={<Link href="/login" />} className="h-11 rounded-full">
                    Log in
                  </Button>
                  <Button
                    className="h-11 rounded-full bg-brand-accent font-semibold text-brand-accent-foreground hover:bg-brand-accent/90"
                    render={<Link href="/signup" />}
                  >
                    Sign up
                  </Button>
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="border-t border-border">
            <a
              href={SUPPORT_PHONE_TEL}
              className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold text-secondary-foreground"
            >
              {SUPPORT_PHONE_DISPLAY}
            </a>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Slim destination search that lives directly under the nav — on the home page
 * it only appears once the hero's own search has scrolled away, mirroring the
 * reference site's sticky search behaviour.
 */
const useSearchRevealed = createScrollFlagStore(560, 460);

type LocationPrediction = { id: string; text: string };

export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState("");
  const [predictions, setPredictions] = useState<LocationPrediction[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (value.trim().length < 2) {
        setPredictions([]);
        return;
      }
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(value)}`);
        const data = await res.json();
        setPredictions(data.predictions ?? []);
      } catch {
        setPredictions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // The home page reveals destination search after its hero scrolls away.
  const isHome = pathname === "/";
  // A specific hotel's own pages (detail, booking review) aren't a place to
  // search for a destination — you're already at one. /hotels itself (the
  // listing/search page) has a dedicated search form below.
  const onHotelDetail = pathname.startsWith("/hotels/");
  // Visa pages carry their own destination search; the hotel bar is noise there.
  const onVisa = pathname === "/visa" || pathname.startsWith("/visa/");
  // Cached + hysteresis store, same reasoning as the header shell: revealing
  // this bar adds ~47px of layout, which feeds back into scroll position. A
  // live `window.scrollY` snapshot would make React's commit-time re-read
  // disagree with render and loop.
  const scrolledPast = useSearchRevealed();
  // Flights has its own route search; this bar submits hotel destinations.
  const onFlights = pathname === "/flights";
  const hasCollectionSearch = pathname === "/hotels" || pathname === "/umrah" || pathname.startsWith("/umrah/");
  const visible = !onHotelDetail && !onVisa && !onFlights && !hasCollectionSearch && (!isHome || scrolledPast);

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 overflow-hidden border-t border-border/70 bg-background"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push(value.trim() ? `/hotels?city=${encodeURIComponent(value.trim())}` : "/hotels");
            }}
            className="mx-auto flex max-w-2xl items-center gap-0 px-4 py-3 transition-[padding] duration-300 ease-out group-data-[condensed]/header:py-1.5"
          >
            <div className="relative min-w-0 flex-1">
              <PlaceIcon
                sx={{ fontSize: 22 }}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setSuggestOpen(false)}
                aria-label="Search destinations"
                placeholder="Where do you want to go?"
                autoComplete="off"
                aria-autocomplete="list"
                className="h-12 w-full rounded-l-xl rounded-r-none border border-r-0 border-input bg-card pr-3 pl-11 text-base text-foreground sm:text-sm outline-none transition-[height] duration-300 ease-out group-data-[condensed]/header:h-9 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              {suggestOpen && predictions.length > 0 ? (
                <div role="listbox" aria-label="Destination suggestions" className="absolute top-full left-0 z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
                  {predictions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setValue(p.text);
                        setPredictions([]);
                        setSuggestOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <PlaceIcon sx={{ fontSize: 16 }} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{p.text}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="submit"
              aria-label="Search hotels"
              className="h-12 shrink-0 rounded-r-xl bg-brand-accent px-7 text-sm font-bold text-brand-accent-foreground transition-all duration-300 ease-out group-data-[condensed]/header:h-9 hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <SearchIcon sx={{ fontSize: 18 }} className="mr-1 -ml-1 align-text-bottom sm:hidden" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <DropdownMenuItem render={<Link href={href} />} className="group/item gap-3 rounded-xl px-2.5 py-2 font-medium">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover/item:bg-primary group-hover/item:text-white">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ArrowForwardIcon sx={{ fontSize: 16 }} className="text-muted-foreground opacity-0 transition-all group-hover/item:translate-x-0.5 group-hover/item:opacity-100" />
    </DropdownMenuItem>
  );
}
