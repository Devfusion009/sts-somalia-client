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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
      <nav aria-label="Primary" className="hidden items-center gap-2 lg:flex" onMouseLeave={scheduleClose}>
        {MEGA_SECTIONS.map((section) => {
          const Icon = ICONS[section.icon];
          const active = pathname.startsWith(section.href);
          const isOpen = openKey === section.key;

          return (
            <div key={section.key} className="relative" onMouseEnter={() => open(section.key)}>
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
                <Icon sx={{ fontSize: 19 }} />
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
                            <p className="mb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                              {column.heading}
                            </p>
                            <ul className="space-y-0.5">
                              {column.links.map((link) => (
                                <li key={link.href + link.label}>
                                  <Link
                                    href={link.href}
                                    onClick={closeNow}
                                    className="block rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
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
            <DropdownMenuTrigger render={<Button variant="ghost" className="h-11 gap-2 rounded-full pl-2 transition-[height] duration-300 ease-out group-data-[condensed]/header:h-9" />}>
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">{initials(profile.full_name, profile.email)}</AvatarFallback>
              </Avatar>
              <span className="max-w-28 truncate">{profile.full_name || "My Account"}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="truncate">{profile.email}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/account" />}>
                <PersonIcon sx={{ fontSize: 18 }} /> My Account
              </DropdownMenuItem>
              {profile?.is_platform_admin ? (
                <DropdownMenuItem render={<Link href={portalHref("admin")} />}>
                  <DashboardIcon sx={{ fontSize: 18 }} /> Admin Console
                </DropdownMenuItem>
              ) : null}
              {contexts.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Switch account</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  {contexts.map((c) => (
                    <DropdownMenuItem key={c.type} render={<Link href={c.href} />}>
                      <DashboardIcon sx={{ fontSize: 18 }} />
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
              <DropdownMenuSeparator />
              <form action={signOutAction}>
                <DropdownMenuItem variant="destructive" render={<button type="submit" className="w-full" />}>
                  <LogoutIcon sx={{ fontSize: 18 }} /> Sign out
                </DropdownMenuItem>
              </form>
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
            <nav className="flex flex-col gap-5">
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
                              className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
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
                  <SheetClose render={<Link href="/account" className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent" />}>
                    My Account
                  </SheetClose>
                  {profile?.is_platform_admin ? (
                    <SheetClose render={<Link href={portalHref("admin")} className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent" />}>
                      Admin Console
                    </SheetClose>
                  ) : null}
                  {contexts.length > 0 ? (
                    <>
                      <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">Switch account</p>
                      {contexts.map((c) => (
                        <SheetClose
                          key={c.type}
                          render={<Link href={c.href} className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent" />}
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
                    <button type="submit" className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-accent">
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

export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState("");
  // Only the home page hides it initially — it already has a big hero search,
  // so this one reveals once that scrolls away. Everywhere else it's always up.
  const isHome = pathname === "/";
  // Cached + hysteresis store, same reasoning as the header shell: revealing
  // this bar adds ~47px of layout, which feeds back into scroll position. A
  // live `window.scrollY` snapshot would make React's commit-time re-read
  // disagree with render and loop.
  const scrolledPast = useSearchRevealed();
  const visible = !isHome || scrolledPast;

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
            <div className="relative flex-1">
              <PlaceIcon
                sx={{ fontSize: 22 }}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label="Search destinations"
                placeholder="Where do you want to go?"
                autoComplete="off"
                className="h-12 w-full rounded-l-xl rounded-r-none border border-r-0 border-input bg-card pr-3 pl-11 text-sm text-foreground outline-none transition-[height] duration-300 ease-out group-data-[condensed]/header:h-9 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <button
              type="submit"
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
