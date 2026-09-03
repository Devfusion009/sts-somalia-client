"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { markupLabel, scopeLabel } from "@/modules/agencies/markup-labels";
import { MarkupChange, ScopeBadge } from "@/modules/agencies/components/markup-change";
import { MarkupRequestReview } from "./markup-request-review";

type Rule = { markup_type: string; value: number };

export type MarkupQueueItem = {
  id: string;
  agencyId: string;
  agencyName: string;
  itemType: string | null;
  action: string;
  markupType: string;
  value: number | null;
  /** Pre-formatted on the server so SSR and hydration render identical text regardless of the browser's timezone. */
  requestedAtLabel: string;
  requester: string;
  /** Live rule for this exact scope, if any. */
  current: Rule | null;
  /** Agency-wide default — what a vertical without its own rule sells at today. */
  fallback: Rule | null;
};

function haystack(item: MarkupQueueItem): string {
  return [
    item.agencyName,
    scopeLabel(item.itemType),
    item.requester,
    item.action === "remove" ? "remove" : markupLabel(item.markupType, item.value),
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Every pending markup request across all agencies, grouped by agency
 * (oldest first) inside a fixed-height scroll region, with a text filter
 * over agency / service / requester / value so a long queue stays workable.
 */
export function MarkupApprovalQueue({ items }: { items: MarkupQueueItem[] }) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q ? items.filter((item) => haystack(item).includes(q)) : items;
    const byAgency = new Map<string, MarkupQueueItem[]>();
    for (const item of visible) {
      const group = byAgency.get(item.agencyId) ?? [];
      group.push(item);
      byAgency.set(item.agencyId, group);
    }
    return [...byAgency.entries()];
  }, [items, query]);

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border !py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Markup approvals
          <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">{items.length}</Badge>
        </CardTitle>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agency, service, requester"
            className="h-9 pl-8"
            aria-label="Search markup requests"
          />
        </div>
      </CardHeader>

      <div className="max-h-[28rem] overflow-y-auto [scrollbar-gutter:stable]">
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No matches.</p>
        ) : (
          <ul className="divide-y divide-border">
            {groups.map(([agencyId, requests]) => (
              <li key={agencyId} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/agencies/${agencyId}#markups`}
                    className="font-heading text-base font-semibold text-primary hover:underline"
                  >
                    {requests[0].agencyName}
                  </Link>
                  {requests.length > 1 ? <Badge variant="secondary">{requests.length} changes</Badge> : null}
                </div>
                <ul className="mt-1 divide-y divide-border/60">
                  {requests.map((request) => (
                    <li key={request.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-6">
                        <div className="min-w-48 space-y-1">
                          <ScopeBadge itemType={request.itemType} />
                          <p className="text-xs text-muted-foreground">
                            {request.requester} · {request.requestedAtLabel}
                          </p>
                        </div>
                        <MarkupChange
                          current={request.current}
                          fallback={request.itemType === null ? null : request.fallback}
                          request={{ action: request.action, markup_type: request.markupType, value: request.value }}
                        />
                      </div>
                      <div className="min-w-56">
                        <MarkupRequestReview requestId={request.id} agencyId={agencyId} />
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
