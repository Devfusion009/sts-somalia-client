import { cva, type VariantProps } from "class-variance-authority"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Label / control / error stacking for forms. Deliberately no
// FieldDescription: helper prose under a field does not ship (AGENTS.md).

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex min-w-0 flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-1 font-heading font-semibold data-[variant=label]:text-sm data-[variant=label]:font-medium data-[variant=legend]:text-base",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-5",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field flex w-full gap-2 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center justify-between *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:items-start",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "w-fit leading-snug group-data-[disabled=true]/field:opacity-50 group-data-[invalid=true]/field:text-destructive",
        className
      )}
      {...props}
    />
  )
}

/**
 * Inline validation message. Pass `children`, or `errors` (string or
 * `{ message }` items, e.g. from a schema result). Renders nothing when
 * there is nothing to say, so it can sit in every field unconditionally.
 */
function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: ReadonlyArray<string | { message?: string } | null | undefined> | string | null
}) {
  let content: React.ReactNode = children
  if (!content && errors) {
    const messages = (typeof errors === "string" ? [errors] : errors)
      .map((e) => (typeof e === "string" ? e : e?.message))
      .filter((m): m is string => Boolean(m))
    const unique = [...new Set(messages)]
    content =
      unique.length === 0 ? null : unique.length === 1 ? (
        unique[0]
      ) : (
        <ul className="ml-4 flex list-disc flex-col gap-1">
          {unique.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )
  }
  if (!content) return null

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-sm font-normal text-destructive", className)}
      {...props}
    >
      {content}
    </div>
  )
}

function FieldSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-separator"
      role="separator"
      className={cn("h-px w-full bg-border", className)}
      {...props}
    />
  )
}

export {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
}
