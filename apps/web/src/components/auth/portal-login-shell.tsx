import Link from "next/link";
import Image from "next/image";
import { rootOrigin } from "@/lib/subdomain";

const ACCENT_ICON_BG: Record<"agent" | "admin" | "manager", string> = {
  agent: "bg-amber-500",
  admin: "bg-blue-500",
  manager: "bg-teal-600",
};

/**
 * Visual wrapper for the dedicated /agent/login, /admin/login, and
 * /manager/login pages. Deliberately distinct from the plain-consumer
 * (auth) layout — a dark, operator-grade backdrop instead of the light
 * marketing chrome — so entering a portal login reads as a different, more
 * professional product, not a reskinned customer form. Reuses the same
 * --sidebar tokens the portal shells already use elsewhere, so this isn't a
 * new palette.
 */
export function PortalLoginShell({
  portalLabel,
  accent,
  children,
}: {
  portalLabel: string;
  accent: "agent" | "admin" | "manager";
  children: React.ReactNode;
}) {
  // From admin.<host>/login or agent.<host>/login, "/" and "/login" need to
  // point back to the root marketing site, not re-resolve within this same
  // subdomain (see homeHref in PortalShell for the identical reasoning).
  // /manager has no dedicated subdomain, so this is always "/login" there.
  const root = rootOrigin();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-sidebar px-4 py-12 text-sidebar-foreground">
      <Link href={root || "/"} className="flex items-center gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg p-1.5 ${ACCENT_ICON_BG[accent]}`}>
          <Image src="/logo-icon.png" alt="" width={790} height={790} className="size-full object-contain" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-heading font-semibold">STS Somalia</span>
          <span className="text-xs text-sidebar-foreground/70">{portalLabel}</span>
        </div>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <Link
        href={root ? `${root}/login` : "/login"}
        className="text-xs text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground hover:underline"
      >
        Not the right account? Customer sign-in
      </Link>
    </div>
  );
}
