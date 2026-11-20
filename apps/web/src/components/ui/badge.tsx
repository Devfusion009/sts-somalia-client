import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex min-h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Soft status tints, built from existing tokens only.
        success:
          "bg-primary/10 text-[color-mix(in_oklch,var(--primary),black_25%)] dark:bg-primary/15 dark:text-primary [a]:hover:bg-primary/15",
        warning:
          "bg-brand-gold/15 text-[color-mix(in_oklch,var(--brand-gold),black_50%)] dark:bg-brand-gold/15 dark:text-brand-gold [a]:hover:bg-brand-gold/20",
        info: "border-border bg-card text-foreground [a]:hover:bg-muted",
        neutral: "bg-muted text-muted-foreground [a]:hover:bg-muted/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // done / good
  active: "success",
  approved: "success",
  completed: "success",
  confirmed: "success",
  delivered: "success",
  issued: "success",
  paid: "success",
  published: "success",
  settled: "success",
  succeeded: "success",
  ticketed: "success",
  verified: "success",
  // waiting on someone
  awaiting_payment: "warning",
  hold: "warning",
  held: "warning",
  in_review: "warning",
  on_hold: "warning",
  partially_paid: "warning",
  pending: "warning",
  pending_payment: "warning",
  pending_review: "warning",
  processing: "warning",
  requested: "warning",
  under_review: "warning",
  waitlisted: "warning",
  // in motion
  in_progress: "info",
  open: "info",
  scheduled: "info",
  submitted: "info",
  // stopped / bad
  blocked: "destructive",
  canceled: "destructive",
  cancelled: "destructive",
  declined: "destructive",
  expired: "destructive",
  failed: "destructive",
  overdue: "destructive",
  rejected: "destructive",
  suspended: "destructive",
  // inert
  archived: "neutral",
  closed: "neutral",
  draft: "neutral",
  inactive: "neutral",
  refunded: "neutral",
  unpaid: "neutral",
}

/**
 * One status -> Badge variant map for the whole app. Unknown statuses fall
 * back to `neutral`; pass `overrides` for a domain-specific meaning.
 */
function statusBadgeVariant(
  status: string | null | undefined,
  overrides?: Partial<Record<string, BadgeVariant>>
): BadgeVariant {
  if (!status) return "neutral"
  const key = status.trim().toLowerCase().replace(/[\s-]+/g, "_")
  return overrides?.[key] ?? STATUS_VARIANTS[key] ?? "neutral"
}

export { Badge, badgeVariants, statusBadgeVariant, type BadgeVariant }
