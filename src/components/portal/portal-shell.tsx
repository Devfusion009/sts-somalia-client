"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LogOut,
  ExternalLink,
  LayoutDashboard,
  User,
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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { signOutAction } from "@/lib/auth/actions";

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
} satisfies Record<string, LucideIcon>;

export type PortalIconName = keyof typeof PORTAL_ICONS;
export type PortalNavItem = { href: string; label: string; icon: PortalIconName };
export type PortalNavGroup = { label: string; items: PortalNavItem[] };

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
  children,
}: {
  portalName: string;
  roleLabel: string;
  navGroups: PortalNavGroup[];
  profileName: string | null;
  profileEmail: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href="/" />}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary p-1">
                  <Image src="/logo-icon.png" alt="" width={790} height={790} className="size-full object-contain" />
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
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = PORTAL_ICONS[item.icon];
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                          tooltip={item.label}
                          render={<Link href={item.href} />}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Back to website" render={<Link href="/" />}>
                    <ExternalLink />
                    <span>Back to website</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Separator className="mb-2" />
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2 px-2 py-1">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials(profileName, profileEmail)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{profileName || "Account"}</span>
                <Badge variant="secondary" className="w-fit text-[10px]">
                  {roleLabel}
                </Badge>
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <form action={signOutAction}>
                <SidebarMenuButton render={<button type="submit" className="w-full" />}>
                  <LogOut />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </form>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium text-muted-foreground">{portalName}</span>
        </header>
        <div className="flex-1 space-y-6 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
