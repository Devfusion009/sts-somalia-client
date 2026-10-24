import { cn } from "@/lib/utils";

/**
 * Not-found / error layout: an optional status code, one short title, and
 * the actions. No explanatory copy by design (AGENTS.md).
 */
export function StatusScreen({
  code,
  title,
  actions,
  reference,
  className,
}: {
  code?: string;
  title: string;
  actions?: React.ReactNode;
  /** Error digest, shown so support can match server logs. */
  reference?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center px-4 py-20 text-center", className)}>
      {code ? <p className="font-mono text-sm font-medium text-muted-foreground tabular-nums">{code}</p> : null}
      <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
      {actions ? (
        <div className="mt-8 flex w-full flex-col-reverse items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
      {reference ? (
        <p className="mt-8 font-mono text-xs text-muted-foreground">
          Reference <span className="select-all">{reference}</span>
        </p>
      ) : null}
    </div>
  );
}
