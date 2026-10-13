"use client";

import { useState } from "react";
import Link from "next/link";
import { History, LifeBuoy, LogOut, MonitorOff, ShieldAlert, ShieldCheck } from "lucide-react";
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
import { signOutAction, signOutEverywhereAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export type AdminMenuInfo = {
  /** At least one verified TOTP factor on this account. */
  mfaEnabled: boolean;
  /** Where "Report a problem" emails go. Omitted = no report button. */
  supportEmail?: string | null;
  /** Deployed commit, quoted in problem reports. */
  buildSha?: string | null;
};

/**
 * The operator console's account menu. An admin has no account to switch
 * into, so it carries what an operator needs from their own account instead:
 * security posture, their own audit trail, help, and session control.
 */
export function AdminAccountMenu({
  trigger,
  children,
  name,
  email,
  info,
}: {
  trigger: React.ReactElement;
  /** Contents of the trigger button (avatar, name, role). */
  children: React.ReactNode;
  name: string | null;
  email: string | null;
  info: AdminMenuInfo;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  function openHelp() {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    setHelpOpen(true);
  }

  function reportHref() {
    const lines = [
      "What happened:",
      "",
      "What you expected:",
      "",
      "---",
      `Page: ${window.location.href}`,
      `Admin: ${email ?? "unknown"}`,
      `Time: ${new Date().toISOString()}`,
      info.buildSha ? `Build: ${info.buildSha.slice(0, 7)}` : null,
      `Browser: ${navigator.userAgent}`,
    ].filter((line) => line !== null);
    const subject = `Admin Console problem: ${document.title}`;
    return `mailto:${info.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
              <span className="truncate text-sm font-medium text-foreground">{name || "Admin"}</span>
              {email ? <span className="truncate text-xs font-normal">{email}</span> : null}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/admin/security" />}>
            {info.mfaEnabled ? <ShieldCheck /> : <ShieldAlert className="text-brand-gold" />}
            Security
            <span
              className={cn(
                "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                info.mfaEnabled ? "bg-primary/10 text-primary" : "bg-brand-gold/15 text-brand-gold"
              )}
            >
              {info.mfaEnabled ? "2FA on" : "2FA off"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/admin/audit-log?actor=me" />}>
            <History /> My activity
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openHelp}>
            <LifeBuoy /> Help &amp; support
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem render={<button type="submit" className="w-full" />}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </form>
          <form action={signOutEverywhereAction}>
            <DropdownMenuItem variant="destructive" render={<button type="submit" className="w-full" />}>
              <MonitorOff /> Sign out of all devices
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Help &amp; support</DialogTitle>
          </DialogHeader>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Keyboard shortcuts</h3>
            <dl className="divide-y divide-border rounded-lg border border-border text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <dt>Show or hide sidebar</dt>
                <dd>
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {isMac ? "⌘" : "Ctrl"} B
                  </kbd>
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Session</h3>
            <dl className="divide-y divide-border rounded-lg border border-border text-sm">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Signed in as</dt>
                <dd className="truncate font-medium">{email ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Two-factor</dt>
                <dd className={cn("font-medium", !info.mfaEnabled && "text-brand-gold")}>
                  {info.mfaEnabled ? "On" : "Off"}
                </dd>
              </div>
              {info.buildSha ? (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">Build</dt>
                  <dd className="font-mono text-xs">{info.buildSha.slice(0, 7)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {info.supportEmail ? (
            <Button
              className="w-full gap-1.5"
              onClick={() => {
                window.location.href = reportHref();
                setHelpOpen(false);
              }}
            >
              <LifeBuoy className="size-4" /> Report a problem
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
