import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/**
 * Reusable alternating image/checklist band. Media side gets a blurred brand
 * blob behind it and a small floating stat card overlapping one corner.
 */
export function FeatureSplit({
  eyebrow,
  title,
  description,
  bullets,
  cta,
  image,
  floatingCard,
  reverse = false,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  cta: { label: string; href: string };
  image: { src: string; alt: string; width: number; height: number };
  floatingCard?: { title: string; subtitle: string };
  reverse?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("py-16 sm:py-20 lg:py-24", className)}>
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <Reveal className={cn("relative", reverse && "lg:order-2")}>
          {/* Decorative offset blob */}
          <div className="absolute -top-8 -left-8 -z-10 size-64 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="w-full rounded-2xl object-cover ring-1 ring-border"
          />
          {floatingCard ? (
            <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-lg sm:-bottom-6 sm:left-8">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-gold/15 text-brand-gold">
                <Star className="size-5 fill-current" aria-hidden />
              </span>
              <span>
                <span className="block font-heading text-sm font-semibold">{floatingCard.title}</span>
                <span className="block text-xs text-muted-foreground">{floatingCard.subtitle}</span>
              </span>
            </div>
          ) : null}
        </Reveal>

        <Reveal delay={120} className={cn(reverse && "lg:order-1")}>
          <p className="text-sm font-semibold tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">{description}</p>

          <ul className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <Button render={<Link href={cta.href} />} className="mt-9 h-12 px-7 text-base font-semibold">
            {cta.label}
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
