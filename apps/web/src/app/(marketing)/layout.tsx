import { Suspense } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { WhatsAppFloatingButton } from "@/components/marketing/whatsapp-button";
import { MuiProvider } from "@/components/mui-provider";
import { NavLoader } from "@/components/marketing/nav-loader";

// MUI is provided here rather than in the root layout: the marketing site is
// the only place its components render, and at the root its Emotion runtime
// shipped to every portal page.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MuiProvider>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <WhatsAppFloatingButton />
        <Suspense fallback={null}>
          <NavLoader />
        </Suspense>
      </div>
    </MuiProvider>
  );
}
