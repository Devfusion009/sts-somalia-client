"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, ChevronDown, LayoutDashboard, User, LogOut, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
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
import { NAV_LINKS, PARTNER_LINKS } from "@/lib/nav-links";
import { signOutAction } from "@/lib/auth/actions";
import { portalForRole } from "@/lib/auth/roles";
import type { Database } from "@/lib/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email || "?";
  return source
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SiteHeaderClient({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const [partnersOpen, setPartnersOpen] = useState(false);
  const portal = profile ? portalForRole(profile.role) : null;

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex">
        {NAV_LINKS.map((link) => (
          <Button
            key={link.href}
            variant="ghost"
            render={<Link href={link.href} />}
            className={pathname.startsWith(link.href) ? "bg-accent text-accent-foreground" : ""}
          >
            {link.label}
          </Button>
        ))}
        <DropdownMenu open={partnersOpen} onOpenChange={setPartnersOpen}>
          <DropdownMenuTrigger render={<Button variant="ghost" />}>
            Partner with us
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {PARTNER_LINKS.map((item) => (
              <DropdownMenuItem
                key={item.href}
                render={<Link href={item.href} />}
                className="flex-col items-start gap-0.5 py-2"
              >
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="hidden items-center gap-2 md:flex">
        {profile ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 pl-2" />}>
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">
                  {initials(profile.full_name, profile.email)}
                </AvatarFallback>
              </Avatar>
              {profile.full_name || "My Account"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="truncate">{profile.email}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/account" />}>
                <User /> My Account
              </DropdownMenuItem>
              {portal ? (
                <DropdownMenuItem render={<Link href={portal.href} />}>
                  <LayoutDashboard /> {portal.label}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <form action={signOutAction}>
                <DropdownMenuItem variant="destructive" render={<button type="submit" className="w-full" />}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button variant="ghost" render={<Link href="/login" />}>
              Log in
            </Button>
            <Button
              className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90"
              render={<Link href="/signup" />}
            >
              Sign up
            </Button>
          </>
        )}
      </div>

      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
          <Menu />
        </SheetTrigger>
        <SheetContent side="right" className="w-72">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4">
            {NAV_LINKS.map((link) => (
              <SheetClose
                key={link.href}
                render={<Link href={link.href} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent" />}
              >
                {link.label}
              </SheetClose>
            ))}
            <div className="mt-2 border-t border-border pt-2">
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Partner with us</p>
              {PARTNER_LINKS.map((item) => (
                <SheetClose
                  key={item.href}
                  render={
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                    />
                  }
                >
                  <Handshake className="size-4" /> {item.label}
                </SheetClose>
              ))}
            </div>
            <div className="mt-2 border-t border-border pt-3">
              {profile ? (
                <div className="flex flex-col gap-1">
                  <SheetClose render={<Link href="/account" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent" />}>
                    My Account
                  </SheetClose>
                  {portal ? (
                    <SheetClose render={<Link href={portal.href} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent" />}>
                      {portal.label}
                    </SheetClose>
                  ) : null}
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-accent"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex flex-col gap-2 px-3">
                  <Button variant="outline" render={<Link href="/login" />}>
                    Log in
                  </Button>
                  <Button
                    className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90"
                    render={<Link href="/signup" />}
                  >
                    Sign up
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
