"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LogOut,
  ExternalLink,
  LayoutDashboard,
  User,
  ShieldPlus,
  Ticket,
  Handshake,
  Users,
  Building2,
  Hotel,
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
  FileText,
  BadgePlus,
  CirclePlus,
  BadgeMinus,
  FileClock,
  RotateCcw,
  ChevronDown,
  CalendarRange,
  Images,
  Star,
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/auth/actions";
import { rootOrigin, stripPortalPrefix, portalHref } from "@/lib/subdomain";
import { cn } from "@/lib/utils";
import type { PartnerContext } from "@/modules/identity/queries";

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
  hotels: Hotel,
  rooms: BedDouble,
  links: Link2,
  payouts: Wallet,
  applications: ClipboardCheck,
  orders: ShoppingCart,
  catalog: BookOpenCheck,
  umrah: Landmark,
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

export type PortalIconName = keyof typeof PORTAL_ICONS;
export type PortalNavItem = { href: string; label: string; icon: PortalIconName; badge?: number };
export type PortalNavGroup = { label: string; items: PortalNavItem[] };
export type PortalAccent = "customer" | "agent" | "admin" | "manager";

// Per-portal identity marker — a refinement of the shared shell, not a
// redesign. Same rounded-card/icon-in-a-circle visual language throughout;
// only the accent color changes so B2C, agent, and admin read as distinct
// products at a glance rather than one shell with swapped labels.
const ACCENT_STYLES: Record<PortalAccent, { bar: string; badge: string; iconBg: string; activeText: string; ring: string }> = {
  customer: {
    bar: "bg-primary",
    badge: "border-primary/25 bg-primary/10 text-primary",
    iconBg: "bg-sidebar-primary",
    activeText: "text-primary",
    ring: "ring-primary/20",
  },
  agent: {
    bar: "bg-amber-500",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    iconBg: "bg-amber-500",
    activeText: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
  },
  admin: {
    bar: "bg-blue-500",
    badge: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    iconBg: "bg-blue-500",
    activeText: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/20",
  },
  manager: {
    bar: "bg-teal-500",
    badge: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-400",
    iconBg: "bg-teal-600",
    activeText: "text-teal-600 dark:text-teal-400",
    ring: "ring-teal-500/20",
  },
};

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
  accent,
}: {
  navGroups: PortalNavGroup[];
  activeHref: string | undefined;
  accent: PortalAccent;
}) {
  const { state } = useSidebar();
  const styles = ACCENT_STYLES[accent];

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

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <>
      {navGroups.map((group) => {
        const isOpen = state === "collapsed" || openGroups.has(group.label);
        return (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel
              render={
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2 rounded-md transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                />
              }
            >
              <span>{group.label}</span>
              <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-200", !isOpen && "-rotate-90")} />
            </SidebarGroupLabel>
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
                          tooltip={item.label}
                          // The base variant only flat-tints the background on
                          // active — an accent-colored left rail + tinted icon
                          // is what makes the active item read as "you are
                          // here" rather than "this happens to be gray".
                          className={cn(
                            "border-l-2 border-transparent pl-[calc(0.5rem-2px)]",
                            active && `border-current ${styles.activeText} [&_svg]:text-current`
                          )}
                          render={<Link href={item.href} />}
                        >
                          <Icon />
                          <span>{item.label}</span>
                          {item.badge ? (
                            <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:right-0.5">
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
  headerExtra,
  accountCode,
  children,
}: {
  portalName: string;
  roleLabel: string;
  navGroups: PortalNavGroup[];
  profileName: string | null;
  profileEmail: string | null;
  /** Every other partner identity (and "Personal Account") this profile can switch into — same list everywhere, see getMyPartnerContexts(). */
  contexts?: PartnerContext[];
  /** Display-only identifier shown under the name in the account menu — e.g. an agent's agent_code. Sign-in stays email + password; this is just something short to quote to support. */
  accountCode?: string | null;
  /** Adds an "Admin Console" switch item — is_platform_admin is a separate flag from `contexts`, which only covers business/partner kinds. */
  isPlatformAdmin?: boolean;
  accent?: PortalAccent;
  /** Agency's own uploaded logo (agent portal only) — replaces the STS icon in the sidebar header so the portal reads as the agency's own, not just a reskinned STS shell. Falls back to /logo-icon.png when unset. */
  brandLogoUrl?: string | null;
  /** Optional content rendered in the top header, left of the accent badge — e.g. admin's notification bell. Unused by other portals. */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const styles = ACCENT_STYLES[accent];
  // Once portal subdomains are configured, "/" from inside admin.* or
  // agent.* would just re-resolve to this same portal (the proxy rewrites
  // "/" to "/admin" or "/agent" on those hosts) — these links need to be
  // absolute back to the root marketing site instead.
  const homeHref = rootOrigin() || "/";

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

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href={homeHref} />}>
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg p-1 ${brandLogoUrl ? "bg-white" : styles.iconBg}`}>
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
                  <span className="font-heading font-semibold">STS Somalia</span>
                  <span className="text-xs text-sidebar-foreground/70">{portalName}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavGroups navGroups={navGroups} activeHref={activeHref} accent={accent} />
          {/* An exit hatch, not a destination — separated from real nav items
              and deliberately muted so it doesn't compete with them. A hotel
              manager's portal isn't a reskinned view of the public site the
              way the other portals are, so there's no "back to website" to
              offer here. */}
          {accent !== "manager" ? (
            <SidebarGroup className="mt-auto">
              <Separator className="mb-2 group-data-[collapsible=icon]:hidden" />
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Back to website"
                      className="text-sidebar-foreground/60 hover:text-sidebar-foreground [&_svg]:size-3.5"
                      render={<Link href={homeHref} />}
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
          <Separator className="mb-2" />
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/50 px-2.5 py-2 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0"
                    />
                  }
                >
                  <Avatar className={`size-9 shrink-0 ring-2 ${styles.ring}`}>
                    <AvatarFallback className="text-xs font-semibold">{initials(profileName, profileEmail)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm leading-none font-medium">{profileName || "Account"}</span>
                    <Badge variant="outline" className={`w-fit text-[10px] ${styles.badge}`}>
                      {roleLabel}
                    </Badge>
                    {accountCode ? (
                      <span className="truncate text-[10px] text-sidebar-foreground/50">{accountCode}</span>
                    ) : null}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Switch account</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  {/* A hotel manager has no B2C account behind it — see the
                      rejection in signInAction. An agent's role fully
                      replaces "customer" on approval — see account/layout.tsx
                      — so /account is a dead end for them too, unlike every
                      other partner portal (hotel partner, affiliate, venue
                      keep their dual Personal/partner access). */}
                  {accent !== "manager" && accent !== "agent" ? (
                    <DropdownMenuItem render={<Link href={rootOrigin() ? `${rootOrigin()}/account` : "/account"} />}>
                      <User /> Personal Account
                    </DropdownMenuItem>
                  ) : null}
                  {isPlatformAdmin ? (
                    <DropdownMenuItem render={<Link href={portalHref("admin")} />}>
                      <ShieldCheck /> Admin Console
                    </DropdownMenuItem>
                  ) : null}
                  {contexts.map((c) => (
                    <DropdownMenuItem key={c.type} render={<Link href={c.href} />}>
                      <LayoutDashboard />
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate">
                          {c.name} <span className="text-muted-foreground">· {c.label}</span>
                        </span>
                        {c.status && c.status !== "live" ? (
                          <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                            {c.status}
                          </Badge>
                        ) : null}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <form action={signOutAction}>
                    <DropdownMenuItem variant="destructive" render={<button type="submit" className="w-full" />}>
                      <LogOut /> Sign out
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className={`h-0.5 w-full shrink-0 ${styles.bar}`} aria-hidden />
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="truncate text-sm font-medium text-muted-foreground">{portalName}</span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {headerExtra}
            {accent !== "customer" ? (
              <Badge variant="outline" className={`hidden text-[10px] tracking-wide uppercase sm:inline-flex ${styles.badge}`}>
                {accent === "admin" ? "Operator console" : accent === "manager" ? "Hotel console" : "Agent workspace"}
              </Badge>
            ) : null}
          </div>
        </header>
        <div className="min-w-0 flex-1 space-y-6 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
