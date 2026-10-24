import Link from "next/link";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * Public-site breadcrumb trail: Home › … › current page (last item, unlinked).
 * `tone="dark"` for trails that sit on a `bg-sidebar` hero band.
 */
export function MarketingBreadcrumb({
  items,
  className,
  tone = "light",
}: {
  items: Array<{ label: string; href?: string }>;
  className?: string;
  tone?: "light" | "dark";
}) {
  const trail = [{ label: "Home", href: "/" }, ...items];
  const dark = tone === "dark";
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className={cn("text-xs", dark && "text-sidebar-foreground/70")}>
        {trail.map((item, i) => (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem className="min-w-0">
              {item.href && i < trail.length - 1 ? (
                // Plain Link rather than BreadcrumbLink: that wrapper is built on
                // Base UI's useRender hook, and this trail renders in Server
                // Components.
                <Link
                  href={item.href}
                  className={cn(
                    "rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    dark ? "hover:text-sidebar-foreground" : "hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <BreadcrumbPage className={cn("truncate font-medium", dark && "text-sidebar-foreground")}>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
