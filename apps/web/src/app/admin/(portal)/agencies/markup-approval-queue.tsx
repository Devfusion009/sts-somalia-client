"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
 * (newest first) inside a fixed-height scroll region, with a text filter
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
          <Badge variant="warning" className="tabular-nums">
            {items.length}
          </Badge>
        </CardTitle>
        <InputGroup className="w-full sm:w-64 max-sm:h-10">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Agency, service, requester"
            aria-label="Search markup requests"
          />
        </InputGroup>
      </CardHeader>

      <div className="max-h-[28rem] overflow-y-auto [scrollbar-gutter:stable]">
        {groups.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>No matching requests</EmptyTitle>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {groups.map(([agencyId, requests]) => (
              <li key={agencyId} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/agencies/${agencyId}#markups`}
                    className="rounded-sm font-heading text-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {requests[0].agencyName}
                  </Link>
                  {requests.length > 1 ? (
                    <Badge variant="neutral" className="tabular-nums">
                      {requests.length} changes
                    </Badge>
                  ) : null}
                </div>
                <ul className="mt-1 divide-y divide-border/60">
                  {requests.map((request) => (
                    <li key={request.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
                        <div className="min-w-0 space-y-1 sm:min-w-48">
                          <ScopeBadge itemType={request.itemType} />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {request.requester} · {request.requestedAtLabel}
                          </p>
                        </div>
                        <MarkupChange
                          current={request.current}
                          fallback={request.itemType === null ? null : request.fallback}
                          request={{ action: request.action, markup_type: request.markupType, value: request.value }}
                        />
                      </div>
                      <div className="w-full sm:w-auto sm:min-w-56">
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
