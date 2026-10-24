import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ADMIN_PAGE_SIZE } from "@/lib/pagination";

/** "26–50 of 118" with previous/next. Renders nothing when everything fits on one page. */
export function Pager({
  page,
  total,
  hrefFor,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  page: number;
  total: number;
  hrefFor: (page: number) => string;
  pageSize?: number;
}) {
  if (total <= pageSize) return null;
  const lastPage = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-muted-foreground">
      <span className="tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1}
          render={page > 1 ? <Link href={hrefFor(page - 1)} prefetch={false} /> : undefined}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= lastPage}
          render={page < lastPage ? <Link href={hrefFor(page + 1)} prefetch={false} /> : undefined}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
