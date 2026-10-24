import { rootOrigin } from "@/lib/subdomain";
import { AuthFooterLink, AuthFrame } from "./auth-frame";

type PortalLoginAccent = "agent" | "admin" | "manager" | "affiliate" | "partner" | "venue";

/**
 * Frame for the centered portal sign-in pages (/manager/login,
 * /affiliate/login, /partner/login, /venue/login): the same AuthFrame as the
 * customer auth pages, with the portal name beside the logo. `accent` is
 * kept for callers; portals no longer carry their own colour.
 */
export function PortalLoginShell({
  portalLabel,
  children,
}: {
  portalLabel: string;
  accent?: PortalLoginAccent;
  children: React.ReactNode;
}) {
  // From e.g. manager.<host>/login, "/" and "/login" need to point back to
  // the root marketing site, not re-resolve within this same subdomain (see
  // homeHref in PortalShell for the identical reasoning). A portal with no
  // subdomain configured yet resolves this to "/login" either way.
  const root = rootOrigin();

  return (
    <AuthFrame
      homeHref={root || "/"}
      label={portalLabel}
      footer={<AuthFooterLink href={root ? `${root}/login` : "/login"}>Customer sign-in</AuthFooterLink>}
    >
      {children}
    </AuthFrame>
  );
}
