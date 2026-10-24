"use client";

import "./globals.css";
import { RouteError, type RouteErrorProps } from "@/components/status/route-error";

// Replaces the root layout when it fails, so it brings its own document and
// stylesheet. No providers or fonts: keep this boundary dependency-free.
export default function GlobalError(props: RouteErrorProps) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        <title>Something went wrong | STS Somalia</title>
        <RouteError
          {...props}
          home={
            // Full document load on purpose: the root layout itself failed.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted max-sm:h-11"
            >
              Go to homepage
            </a>
          }
        />
      </body>
    </html>
  );
}
