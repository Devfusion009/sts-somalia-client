import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  /** Page title, rendered as the page's single h1. */
  title: React.ReactNode
  /** One muted line of facts under the title, e.g. `City · Owner · 4 rooms`. */
  meta?: React.ReactNode
  /** Usually a `<Badge>`; sits inline after the title. */
  status?: React.ReactNode
  /** Right-aligned on desktop, wraps under the title on mobile. */
  actions?: React.ReactNode
  /** The page's one way back. Keep the label short ("Bookings"). */
  back?: { href: string; label: string }
}

function PageHeader({
  title,
  meta,
  status,
  actions,
  back,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {back ? (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">
              {title}
            </h1>
            {status}
          </div>
          {meta ? (
            <div className="text-sm text-muted-foreground">{meta}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export { PageHeader, type PageHeaderProps }
