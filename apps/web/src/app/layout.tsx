import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono, Tajawal, Amiri, ADLaM_Display } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { TrpcProvider } from "@/lib/trpc/provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

/**
 * Display face for the hero headline ONLY (see hero-carousel.tsx). Nothing else
 * uses `--font-display`; every other heading stays on Plus Jakarta.
 *
 * ── Swapping in the real Dubai Font ──────────────────────────────────────────
 * Dubai Font (Nadine Chahine / Monotype, commissioned by the Dubai government)
 * is free to use but is NOT published on Google Fonts and has no official npm
 * package, so it can't be fetched at build time. To use the genuine face:
 *
 *   1. Download it from https://dubaifont.com  (free, incl. commercial use)
 *   2. Put `DubaiW23-Regular.woff2` and `DubaiW23-Bold.woff2` in
 *      `public/fonts/`
 *   3. Replace this block with:
 *
 *        import localFont from "next/font/local";
 *        const dubai = localFont({
 *          variable: "--font-display",
 *          src: [
 *            { path: "../../public/fonts/DubaiW23-Regular.woff2", weight: "400" },
 *            { path: "../../public/fonts/DubaiW23-Bold.woff2",    weight: "700" },
 *          ],
 *        });
 *
 *   4. Swap `${tajawal.variable} ${amiri.variable} ${adlam.variable}` for `${dubai.variable}` on <html> below.
 *
 * Until then this is Tajawal — the closest free stand-in. Dubai Font's Latin is
 * a humanist sans in the Frutiger lineage (same designer), and Tajawal shares
 * that structure and its slightly condensed proportions; Cairo, the other
 * obvious candidate, is noticeably more geometric and rounded. Swapping to
 * Cairo or Almarai is a one-line change if this reads too plain.
 *
 * Tajawal is not a variable font, so the weights used by the hero (bold) have
 * to be listed explicitly or next/font throws at build time.
 */
const tajawal = Tajawal({
  variable: "--font-display",
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "700", "800"],
});

/**
 * Islamic display face, used on the Umrah hero slide only (hero-carousel.tsx).
 *
 * Amiri is Khaled Hosny's revival of the Naskh cut used by the Bulaq Press in
 * Cairo — the most widely used and respected Arabic/Islamic typeface on Google
 * Fonts. Its Latin companion is a high-contrast old-style serif, so an English
 * headline set in it reads classical and reverent rather than as pastiche,
 * which matters for pilgrimage content.
 *
 * Not a variable font — its 400/700 weights must be listed or the build fails.
 */
const amiri = Amiri({
  variable: "--font-islamic",
  subsets: ["latin", "arabic"],
  weight: ["400", "700"],
});

/**
 * African display face, used on the Somalia/East Africa hero slide and on
 * the season-picker's per-season headline (season-picker.tsx) — both content
 * genuinely about Somalia's own calendar and geography.
 *
 * ADLaM Display is drawn for the ADLaM script — an alphabet invented in Guinea
 * in the 1980s by Abdoulaye and Ibrahima Barry so Pular/Fulani could be written
 * in its own letters. It is probably the best-known African type project of the
 * last decade, and unlike a Latin font merely themed "African" it carries a
 * real African writing system. Its Latin companion has the same broad, rounded
 * strokes, which suits a warm coastal headline.
 *
 * Single 400 weight, so the headline's `font-bold` has nothing to snap to —
 * that slide leans on size rather than weight for emphasis.
 */
const adlam = ADLaM_Display({
  variable: "--font-african",
  subsets: ["latin", "adlam"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "STS Somalia | Flights, Hotels, Visa & Umrah",
    template: "%s | STS Somalia",
  },
  description:
    "Scout Travel Solution — book flights, hotels, visas, and Umrah packages, with dedicated portals for travel agents, hotel partners, and affiliates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable} ${tajawal.variable} ${amiri.variable} ${adlam.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TrpcProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </TrpcProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
