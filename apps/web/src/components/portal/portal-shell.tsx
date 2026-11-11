"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  LayoutDashboard,
  User,
  ShieldPlus,
  Ticket,
  Handshake,
  Users,
  Building2,
  BedDouble,
  Link2,
  Wallet,
  ClipboardCheck,
  ShoppingCart,
  BookOpenCheck,
  Landmark,
  ShieldCheck,
  Stamp,
  Plane,
  PartyPopper,
  CreditCard,
  Layers,
  ScrollText,
  Megaphone,
  TrendingDown,
  TrendingUp,
  Plug,
  SlidersHorizontal,
  FileText,
  BadgePlus,
  CirclePlus,
  BadgeMinus,
  FileClock,
  RotateCcw,
  ChevronDown,
  ChevronsUpDown,
  CalendarRange,
  Images,
  Star,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PortalAccountMenu } from "@/components/portal/portal-account-menu";
import { AdminAccountMenu, type AdminMenuInfo } from "@/components/portal/admin-account-menu";
import { rootOrigin, stripPortalPrefix } from "@/lib/subdomain";
import { cn } from "@/lib/utils";
import type { PartnerContext } from "@/modules/identity/queries";
import { filterNavigationGroups } from "./navigation-search";
import { UmrahIcon } from "./umrah-icon";

// Icons are resolved from a string key (not passed as component references)
// because PortalShell is a Client Component: Server Component layouts can
// only pass plain serializable data as props, not function/class values.
export const PORTAL_ICONS = {
  overview: LayoutDashboard,
  profile: User,
  bookings: Ticket,
  "become-partner": Handshake,
  team: Users,
  agency: Building2,
  hotels: BedDouble,
  rooms: BedDouble,
  links: Link2,
  payouts: Wallet,
  applications: ClipboardCheck,
  orders: ShoppingCart,
  catalog: BookOpenCheck,
  umrah: UmrahIcon,
  admin: ShieldCheck,
  visa: Stamp,
  flights: Plane,
  events: PartyPopper,
  payments: CreditCard,
  tiers: Layers,
  audit: ScrollText,
  security: ShieldPlus,
  broadcast: Megaphone,
  aging: TrendingDown,
  integrations: Plug,
  settings: SlidersHorizontal,
  invoice: FileText,
  bank: Landmark,
  "credit-note": BadgePlus,
  "debit-note": BadgeMinus,
  statement: FileClock,
  earnings: TrendingUp,
  refund: RotateCcw,
  calendar: CalendarRange,
  photos: Images,
  reviews: Star,
  "new-booking": CirclePlus,
} satisfies Record<string, LucideIcon>;

const SUPPORT_EMAIL = "info@scoutsts.com";

const MANAGER_TIPS = [
  { label: "Front Desk: new booking", keys: "Drag empty cells" },
  { label: "Front Desk: move a booking", keys: "Drag the bar" },
  { label: "Front Desk: open details", keys: "Click the bar" },
];

export type PortalIconName = keyof typeof PORTAL_ICONS;
export type PortalNavItem = { href: string; label: string; icon: PortalIconName; badge?: number; searchTerms?: string };
export type PortalNavGroup = { label: string; items: PortalNavItem[]; alwaysOpen?: boolean };
export type PortalAccent = "customer" | "agent" | "admin" | "manager";

/**
 * Nav groups as an accordion — collapsed by default, except the group
 * containing the active page. Portals with 15+ items across 4 groups
 * (agent, admin) were an unbroken wall of links; this is the same trade-off
 * the reference B2B dashboard makes (expandable sections, one open at a
 * time by default) and it also just degrades gracefully for the 3-item
 * portals (customer/partner/affiliate) that don't strictly need it.
 *
 * A separate component (not inlined in PortalShell) because useSidebar()
 * only works below SidebarProvider, which PortalShell itself renders.
 * Ignores the open/closed state entirely when the whole sidebar is in its
 * icon-only collapsed width — there, every item is already a bare icon
 * button with no group header visible, so filtering by group would just
 * make icons vanish for no visible reason.
 */
function NavGroups({
  navGroups,
  activeHref,
  query = "",
  onNavigate,
}: {
  navGroups: PortalNavGroup[];
  activeHref: string | undefined;
  query?: string;
  onNavigate?: () => void;
}) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const iconOnly = state === "collapsed" && !isMobile;
  const isSearching = !iconOnly && query.trim().length > 0;
  const visibleGroups = filterNavigationGroups(navGroups, isSearching ? query : "");

  // Both sides normalised: nav items carry the canonical "/admin/..." path
  // while the address bar shows the proxy-rewritten "/..." on a portal
  // subdomain. See stripPortalPrefix.
  const currentPath = stripPortalPrefix(activeHref);
  const isActiveItem = (href: string) => stripPortalPrefix(href) === currentPath;

  const groupFor = (href: string | undefined) => {
    const target = stripPortalPrefix(href);
    return navGroups.find((group) => group.items.some((item) => stripPortalPrefix(item.href) === target))
      ?.label;
  };

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const activeGroup = groupFor(activeHref);
    return new Set(activeGroup ? [activeGroup] : navGroups[0] ? [navGroups[0].label] : []);
  });

  // Reopen the group containing the current page whenever navigation moves us
  // into a different one.
  //
  // The initialiser above runs once. PortalShell is a client component that
  // stays mounted across client-side navigation, so following a link into a
  // collapsed section changed the page while leaving its group shut — the
  // active item was simply not on screen, and finding your way back meant
  // reopening groups by hand. Derived during render rather than in an effect,
  // matching the pattern used elsewhere in this codebase.
  //
  // Only ADDS to the open set: a group the user opened themselves stays open,
  // so this never fights a deliberate toggle.
  const [lastHref, setLastHref] = useState(activeHref);
  if (activeHref !== lastHref) {
    setLastHref(activeHref);
    const activeGroup = groupFor(activeHref);
    if (activeGroup && !openGroups.has(activeGroup)) {
      setOpenGroups((prev) => new Set(prev).add(activeGroup));
    }
  }

  function toggleGroup(label: string, groupEl: HTMLElement | null) {
    const opening = !openGroups.has(label);
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
    // A group opened near the bottom (Settings) expanded below the fold of the
    // scrolling sidebar, so it looked like nothing happened.
    if (opening && groupEl) {
      requestAnimationFrame(() => groupEl.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
  }

  return (
    <>
      {visibleGroups.length === 0 ? <div role="status" className="px-5 py-6 text-xs text-sidebar-foreground/60">No pages found.</div> : null}
      {visibleGroups.map((group) => {
        const isOpen = group.alwaysOpen || isSearching || iconOnly || openGroups.has(group.label);
        return (
          <SidebarGroup key={group.label}>
            {iconOnly ? null : group.alwaysOpen || isSearching ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : <SidebarGroupLabel
              render={
                <button
                  type="button"
                  onClick={(e) => toggleGroup(group.label, e.currentTarget.closest<HTMLElement>("[data-slot=sidebar-group]"))}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2 rounded-md text-[11px] font-medium text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
                />
              }
            >
              <span>{group.label}</span>
              <span className="ml-auto flex items-center gap-2">
                {!isOpen && group.items.some((item) => (item.badge ?? 0) > 0) ? <span role="img" aria-label="Pending items" className="size-1.5 rounded-full bg-sidebar-primary" /> : null}
                <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-200", !isOpen && "-rotate-90")} />
              </span>
            </SidebarGroupLabel>}
            {isOpen ? (
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = PORTAL_ICONS[item.icon];
                    const active = isActiveItem(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={active}
                          aria-current={active ? "page" : undefined}
                          tooltip={item.label}
                          // Active = filled row, white label, brand-teal icon.
                          className={cn(
                            "text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 [&_svg]:text-sidebar-foreground/60",
                            active && "[&_svg]:text-sidebar-primary"
                          )}
                          render={<Link href={item.href} onClick={onNavigate ? () => { onNavigate(); setOpenMobile(false); } : undefined} />}
                        >
                          <Icon />
                          <span>{item.label}</span>
                          {item.badge ? (
                            <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground tabular-nums group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:right-0.5">
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          ) : null}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            ) : null}
          </SidebarGroup>
        );
      })}
    </>
  );
}

function PortalHomeLink({ onActivate, onClick, ...props }: React.ComponentProps<typeof Link> & { onActivate?: () => void }) {
  const { setOpenMobile } = useSidebar();
  return <Link {...props} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      onActivate?.();
      setOpenMobile(false);
    }
  }} />;
}

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email || "?";
  return source
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PortalShell({
  portalName,
  roleLabel,
  navGroups,
  profileName,
  profileEmail,
  contexts = [],
  isPlatformAdmin = false,
  accent = "customer",
  brandLogoUrl,
  brandName,
  headerExtra,
  accountCode,
  adminMenu,
  menuInfo,
  className,
  searchableNavigation = false,
  children,
}: {
  portalName: string;
  roleLabel: string;
  navGroups: PortalNavGroup[];
  profileName: string | null;
  profileEmail: string | null;
  /** Every other partner identity (and "Personal Account") this profile can switch into — same list everywhere, see getMyPartnerContexts(). */
  contexts?: PartnerContext[] | Promise<PartnerContext[]>;
  /** Short identifier shown with the role in the account menu — the agent portal shows "agent code · username". */
  accountCode?: string | null;
  /** Adds an "Admin Console" switch item — is_platform_admin is a separate flag from `contexts`, which only covers business/partner kinds. */
  isPlatformAdmin?: boolean;
  accent?: PortalAccent;
  /** Agency's own uploaded logo (agent portal only) — replaces the STS icon in the sidebar header so the portal reads as the agency's own, not just a reskinned STS shell. Falls back to /logo-icon.png when unset. */
  brandLogoUrl?: string | null;
  /** Replaces "STS Somalia" in the sidebar header when the portal belongs to one business (a hotel manager's hotel). */
  brandName?: string;
  /** Optional content rendered in the top header, left of the accent badge — e.g. admin's notification bell. Unused by other portals. */
  headerExtra?: React.ReactNode;
  /** Admin console only: replaces the account switcher with the operator's own account menu. */
  adminMenu?: AdminMenuInfo;
  /** Help-dialog context for the non-admin portals: workspace name, deployed commit, support address override. */
  menuInfo?: { workspace?: string | null; buildSha?: string | null; supportEmail?: string };
  /** Portal-specific visual treatment; shared navigation behavior stays in this shell. */
  className?: string;
  /** Optional client-side page finder; enabled for the admin console. */
  searchableNavigation?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navQuery, setNavQuery] = useState("");
  // The sidebar's own brand mark: like Stripe's or Shopify's dashboard logo,
  // it returns to this portal's own home, never out to the public site — an
  // operator console is a separate product from the B2C site, not a section
  // of it. "Back to website" below is the one deliberate, labeled exit.
  const dashboardHref = navGroups[0]?.items[0]?.href ?? "/";
  // Once portal subdomains are configured, "/" from inside admin.* or
  // agent.* would just re-resolve to this same portal (the proxy rewrites
  // "/" to "/admin" or "/agent" on those hosts) — this needs to be absolute
  // back to the root marketing site instead.
  const websiteHref = rootOrigin() || "/";

  // A route like "/admin/catalog/umrah" also starts with "/admin", so
  // naively prefix-matching every item would highlight "Dashboard" (href
  // "/admin") at the same time as "Umrah Catalog". Only the single item
  // with the longest matching href should be treated as active.
  //
  // Both sides are stripped of their portal prefix first. Nav items are
  // declared with the canonical route ("/admin/orders"), but on a portal
  // subdomain the proxy REWRITES admin.<host>/orders to /admin/orders — a
  // rewrite, so usePathname() still reports "/orders". Matching them raw
  // produced no match for any item on any admin or agent page: nothing was
  // ever highlighted, and NavGroups fell back to opening the first group
  // instead of the one you were actually in.
  const currentPath = stripPortalPrefix(pathname) ?? pathname;
  const activeHref = navGroups
    .flatMap((group) => group.items)
    .map((item) => item.href)
    .filter((href) => {
      const target = stripPortalPrefix(href) ?? href;
      return currentPath === target || currentPath.startsWith(`${target}/`);
    })
    .sort((a, b) => b.length - a.length)[0];

  const accountTrigger = (
    <SidebarMenuButton
      size="lg"
      className="flex items-center gap-2.5 rounded-lg border border-sidebar-border px-2 py-2 hover:bg-sidebar-accent/60 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-0"
    />
  );
  const accountTriggerContent = (
    <>
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
          {initials(profileName, profileEmail)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1 group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm leading-none font-medium text-white">{profileName || "Account"}</span>
        <span className="truncate text-[11px] leading-none text-sidebar-foreground/60">
          {roleLabel}
          {accountCode ? ` · ${accountCode}` : ""}
        </span>
      </div>
      <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden" />
    </>
  );

  return (
    <SidebarProvider className={className}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<PortalHomeLink href={dashboardHref} onActivate={() => setNavQuery("")} />}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white p-1">
                  {brandLogoUrl ? (
                    // Agency's own uploaded logo — a Supabase Storage URL, not a
                    // static local asset, so next/image (which needs the remote
                    // host allow-listed in next.config.ts) isn't used here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brandLogoUrl} alt="" className="size-full object-contain" />
                  ) : (
                    <Image src="/logo-icon.png" alt="" width={790} height={790} className="size-full object-contain" />
                  )}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="truncate font-heading font-semibold text-white">{brandName ?? "STS Somalia"}</span>
                  <span className="text-xs text-sidebar-foreground/60">{portalName}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {searchableNavigation ? (
            <div className="relative mt-2 group-data-[collapsible=icon]:hidden">
              <Search className="pointer-events-none absolute top-2.5 left-3 z-10 size-4 text-sidebar-foreground/50" aria-hidden="true" />
              <SidebarInput
                type="search"
                aria-label="Search navigation"
                placeholder="Find a page…"
                value={navQuery}
                onChange={(event) => setNavQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Escape") setNavQuery(""); }}
                autoComplete="off"
                className="h-9 border-sidebar-border bg-sidebar-accent/70 pr-9 pl-9 text-xs text-sidebar-foreground shadow-none placeholder:text-sidebar-foreground/50 focus-visible:ring-sidebar-ring [&::-webkit-search-cancel-button]:hidden"
              />
              {navQuery ? <button type="button" aria-label="Clear navigation search" onClick={() => setNavQuery("")} className="absolute top-0.5 right-1 flex size-8 items-center justify-center rounded-md text-sidebar-foreground/60 hover:text-white focus-visible:outline-2 focus-visible:outline-sidebar-ring"><X className="size-3.5" aria-hidden="true" /></button> : null}
            </div>
          ) : null}
        </SidebarHeader>
        <SidebarContent>
          <NavGroups navGroups={navGroups} activeHref={activeHref} query={navQuery} onNavigate={searchableNavigation ? () => setNavQuery("") : undefined} />
          {/* An exit hatch, not a destination — separated from real nav items
              and deliberately muted so it doesn't compete with them. A hotel
              manager's portal isn't a reskinned view of the public site the
              way the other portals are, and the admin console is an internal
              tool, so neither offers a "back to website". */}
          {accent !== "manager" && accent !== "admin" ? (
            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Back to website"
                      className="text-sidebar-foreground/55 hover:text-sidebar-foreground [&_svg]:size-3.5"
                      render={<Link href={websiteHref} />}
                    >
                      <ExternalLink />
                      <span className="text-xs">Back to website</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              {accent === "admin" && adminMenu ? (
                <AdminAccountMenu trigger={accountTrigger} name={profileName} email={profileEmail} info={adminMenu}>
                  {accountTriggerContent}
                </AdminAccountMenu>
              ) : (
                <PortalAccountMenu
                  trigger={accountTrigger}
                  name={profileName}
                  email={profileEmail}
                  roleLabel={roleLabel}
                  accountCode={accountCode}
                  contexts={contexts}
                  isPlatformAdmin={isPlatformAdmin}
                  // A hotel manager has no B2C account behind it — see the
                  // rejection in signInAction. An agent's role fully replaces
                  // "customer" on approval — see account/layout.tsx — so
                  // /account is a dead end for them too, unlike every other
                  // partner portal (hotel partner, affiliate, venue keep their
                  // dual Personal/partner access).
                  showPersonalAccount={accent !== "manager" && accent !== "agent"}
                  info={{
                    supportEmail: menuInfo?.supportEmail ?? SUPPORT_EMAIL,
                    buildSha: menuInfo?.buildSha ?? null,
                    workspace: menuInfo?.workspace ?? null,
                    securityHref: accent === "agent" ? "/agent/security" : accent === "customer" ? "/account/security" : null,
                    tips: accent === "manager" ? MANAGER_TIPS : [],
                  }}
                >
                  {accountTriggerContent}
                </PortalAccountMenu>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-5">
          <SidebarTrigger className="text-muted-foreground max-sm:size-10" />
          <Separator orientation="vertical" className="h-4" />
          <span className="truncate text-sm font-medium">{portalName}</span>
          <div className="ml-auto flex shrink-0 items-center gap-2">{headerExtra}</div>
        </header>
        <div className="mx-auto w-full max-w-[1480px] min-w-0 flex-1 space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
