import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Control height shared by every auth form: 44px across screen sizes. */
export const AUTH_CONTROL = "h-11";

/**
 * Centered auth layout used by /signup, /forgot-password, /reset-password,
 * /login/verify-2fa and the portal sign-in pages without a split layout.
 * `homeHref` must be the root marketing origin on portal subdomains.
 */
export function AuthFrame({
  homeHref = "/",
  label,
  footer,
  children,
}: {
  homeHref?: string;
  /** Portal name shown beside the logo. */
  label?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-secondary/30 px-4 py-12">
      <AuthLogo href={homeHref} label={label} />
      <div className="w-full max-w-md">{children}</div>
      {footer}
    </div>
  );
}

export function AuthLogo({ href, label, className }: { href: string; label?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <Image src="/logo.png" alt="STS Somalia" width={714} height={312} priority className="h-10 w-auto" />
      {label ? (
        <>
          <span aria-hidden className="h-6 w-px bg-border" />
          <span className="font-heading text-sm font-semibold text-foreground">{label}</span>
        </>
      ) : null}
    </Link>
  );
}

/** The card every auth form sits in: one h1, then the form. */
export function AuthCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-6 py-6 sm:py-8", className)}>
      <CardHeader className="px-6 sm:px-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
      </CardHeader>
      <CardContent className="px-6 sm:px-8">{children}</CardContent>
    </Card>
  );
}

/** Quiet text link under a card ("Back to log in", "Customer sign-in"). */
export function AuthFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  );
}
