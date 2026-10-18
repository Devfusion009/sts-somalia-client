"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Copy,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  MessageCircle,
  MonitorOff,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signOutAction, signOutEverywhereAction } from "@/lib/auth/actions";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";
import { whatsappLink } from "@/lib/whatsapp";
import { rootOrigin, portalHref } from "@/lib/subdomain";
import type { PartnerContext } from "@/modules/identity/queries";
import { cn } from "@/lib/utils";

export type PortalMenuInfo = {
  supportEmail: string;
  buildSha?: string | null;
  /** Business the portal belongs to (a hotel's name), quoted in help requests. */
  workspace?: string | null;
  /** Account security page for portals that have one. */
  securityHref?: string | null;
  /** Portal-specific gestures and shortcuts listed in Help. */
  tips?: Array<{ label: string; keys: string }>;
};

const MODIFIER_TIP = { label: "Show or hide sidebar", keys: "Ctrl B" };

/**
 * Account menu for every operator portal except admin (which has its own,
 * see admin-account-menu.tsx). Carries the identity, account switching,
 * help and session control the portal needs — every entry is a real route
 * or action.
 */
export function PortalAccountMenu({
  trigger,
  children,
  name,
  email,
  roleLabel,
  accountCode,
  contexts,
  isPlatformAdmin,
  showPersonalAccount,
  info,
}: {
  trigger: React.ReactElement;
  children: React.ReactNode;
  name: string | null;
  email: string | null;
  roleLabel: string;
  accountCode?: string | null;
  contexts: PartnerContext[];
  isPlatformAdmin: boolean;
  showPersonalAccount: boolean;
  info: PortalMenuInfo;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [copied, setCopied] = useState(false);

  function openHelp() {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    setHelpOpen(true);
  }

  function contextLines() {
    return [
      `Account: ${name ?? "unknown"} <${email ?? "unknown"}>`,
      `Role: ${roleLabel}`,
      info.workspace ? `Workspace: ${info.workspace}` : null,
      accountCode ? `Account code: ${accountCode}` : null,
      `Page: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      info.buildSha ? `Build: ${info.buildSha.slice(0, 7)}` : null,
      `Browser: ${navigator.userAgent}`,
    ].filter((line): line is string => line !== null);
  }

  function reportHref() {
    const body = ["What happened:", "", "What you expected:", "", "---", ...contextLines()].join("\n");
    const subject = `${roleLabel} portal problem: ${document.title}`;
    return `mailto:${info.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(contextLines().join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: nothing to copy to */
    }
  }

  const tips = [MODIFIER_TIP, ...(info.tips ?? [])];
  const initials = (name || email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-72 overflow-hidden rounded-2xl p-0 shadow-2xl ring-1 ring-foreground/10">
          <div className="flex items-center gap-3 border-b border-border bg-secondary/50 px-4 py-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name || "Account"}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px] font-semibold tracking-wide uppercase">
                {roleLabel}
                {accountCode ? ` · ${accountCode}` : ""}
              </Badge>
            </div>
          </div>

          <div className="p-1.5">
            {showPersonalAccount || isPlatformAdmin || contexts.length > 0 ? (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 text-[11px] tracking-wider uppercase">Switch account</DropdownMenuLabel>
                </DropdownMenuGroup>
                {showPersonalAccount ? (
                  <DropdownMenuItem render={<Link href={rootOrigin() ? `${rootOrigin()}/account` : "/account"} />} className="gap-2.5 rounded-lg py-2">
                    <User /> Personal Account
                  </DropdownMenuItem>
                ) : null}
                {isPlatformAdmin ? (
                  <DropdownMenuItem render={<Link href={portalHref("admin")} />} className="gap-2.5 rounded-lg py-2">
                    <ShieldCheck /> Admin Console
                  </DropdownMenuItem>
                ) : null}
                {contexts.map((c) => (
                  <DropdownMenuItem key={c.type} render={<Link href={c.href} />} className="gap-2.5 rounded-lg py-2">
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
              </>
            ) : null}

            {info.securityHref ? (
              <DropdownMenuItem render={<Link href={info.securityHref} />} className="gap-2.5 rounded-lg py-2">
                <ShieldCheck /> Security
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={openHelp} className="gap-2.5 rounded-lg py-2">
              <LifeBuoy /> Help &amp; support
            </DropdownMenuItem>
          </div>

          <div className="border-t border-border p-1.5">
            <form action={signOutAction}>
              <DropdownMenuItem render={<button type="submit" className="w-full" />} className="gap-2.5 rounded-lg py-2">
                <LogOut /> Sign out
              </DropdownMenuItem>
            </form>
            <form action={signOutEverywhereAction}>
              <DropdownMenuItem variant="destructive" render={<button type="submit" className="w-full" />} className="gap-2.5 rounded-lg py-2">
                <MonitorOff /> Sign out of all devices
              </DropdownMenuItem>
            </form>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Help &amp; support</DialogTitle>
          </DialogHeader>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Contact STS</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <a
                href={SUPPORT_PHONE_TEL}
                className="group flex flex-col gap-1.5 rounded-xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <Phone className="size-4 text-primary" />
                <span className="text-sm font-semibold">Call</span>
                <span className="text-xs text-muted-foreground tabular-nums">{SUPPORT_PHONE_DISPLAY}</span>
              </a>
              <a
                href={whatsappLink(`Hello STS, I need help with my ${roleLabel} account${info.workspace ? ` (${info.workspace})` : ""}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-1.5 rounded-xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <MessageCircle className="size-4 text-primary" />
                <span className="text-sm font-semibold">WhatsApp</span>
                <span className="text-xs text-muted-foreground">Chat with support</span>
              </a>
              <a
                href={`mailto:${info.supportEmail}`}
                className="group flex flex-col gap-1.5 rounded-xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <Mail className="size-4 text-primary" />
                <span className="text-sm font-semibold">Email</span>
                <span className="truncate text-xs text-muted-foreground">{info.supportEmail}</span>
              </a>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Shortcuts</h3>
            <dl className="divide-y divide-border rounded-xl border border-border text-sm">
              {tips.map((tip) => (
                <div key={tip.label} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt>{tip.label}</dt>
                  <dd>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {tip.keys.replace("Ctrl", isMac ? "⌘" : "Ctrl")}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Session</h3>
            <dl className="divide-y divide-border rounded-xl border border-border text-sm">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Signed in as</dt>
                <dd className="truncate font-medium">{email ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium">{roleLabel}</dd>
              </div>
              {info.workspace ? (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">Hotel</dt>
                  <dd className="truncate font-medium">{info.workspace}</dd>
                </div>
              ) : null}
              {info.buildSha ? (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">Build</dt>
                  <dd className="font-mono text-xs">{info.buildSha.slice(0, 7)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1 gap-1.5"
              onClick={() => {
                window.location.href = reportHref();
                setHelpOpen(false);
              }}
            >
              <LifeBuoy className="size-4" /> Report a problem <ArrowRight className="size-3.5" />
            </Button>
            <Button variant="outline" className={cn("gap-1.5", copied && "text-primary")} onClick={copyDetails}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy details"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
