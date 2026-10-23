"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RoomNight } from "@/modules/hotels/availability";
import type { NightlyRate } from "@/modules/hotels/rates";

export function RoomNightsTable({
  nights,
  currency,
  rates = {},
}: {
  nights: RoomNight[];
  currency: string;
  rates?: Record<string, NightlyRate>;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const minNight = nights[0]?.night;
  const maxNight = nights[nights.length - 1]?.night;

  const filtered = useMemo(
    () => nights.filter((n) => (!from || n.night >= from) && (!to || n.night <= to)),
    [nights, from, to]
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Input
          type="date"
          aria-label="From"
          min={minNight}
          max={to || maxNight}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-auto"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="date"
          aria-label="To"
          min={from || minNight}
          max={maxNight}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-auto"
        />
        {from || to ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Night</TableHead>
            <TableHead className="text-right">Confirmed</TableHead>
            <TableHead className="text-right">On request</TableHead>
            <TableHead className="text-right">Left</TableHead>
            <TableHead className="text-right">Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No nights in range.
              </TableCell>
            </TableRow>
          ) : null}
          {filtered.map((n) => {
            const low = n.capacity !== null && n.available !== null && n.available > 0 && n.available <= Math.max(1, Math.ceil(n.capacity * 0.2));
            const detail =
              n.capacity !== null
                ? `${n.capacity} capacity · ${n.b2b} agency · ${n.b2c} customer · ${n.confirmed} confirmed · ${n.pending} pending`
                : undefined;
            return (
              <TableRow key={n.night}>
                <TableCell className="font-medium">{format(new Date(`${n.night}T00:00:00`), "EEE d MMM")}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {n.confirmed > 0 ? <span className="font-semibold text-primary">{n.confirmed}</span> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {n.pending > 0 ? <span className="font-semibold text-brand-gold">{n.pending}</span> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums" title={detail}>
                  {n.capacity === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : n.available !== null && n.available <= 0 ? (
                    <Badge variant="destructive">0/{n.capacity}</Badge>
                  ) : (
                    <span className={cn(low && "font-semibold text-brand-gold")}>
                      {n.available}
                      <span className="text-muted-foreground">/{n.capacity}</span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <RateCell rate={rates[n.night]} override={n.priceOverride} currency={currency} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function money(amount: number) {
  const cents = Math.round(amount * 100) / 100;
  return Number.isInteger(cents) ? cents.toFixed(0) : cents.toFixed(2);
}

/** The selling rate for the night, tagged with where it comes from when it isn't the base rate. */
function RateCell({ rate, override, currency }: { rate?: NightlyRate; override: number | null; currency: string }) {
  const amount = rate?.rate ?? override;
  if (amount === undefined || amount === null) return <span className="text-muted-foreground">Base</span>;
  const tag = rate ? (rate.source === "override" ? "Override" : rate.source === "rule" ? rate.ruleName : null) : "Override";
  return (
    <span className="inline-flex items-baseline gap-2">
      {tag ? <span className="text-xs text-muted-foreground">{tag}</span> : null}
      <span className={cn(rate?.source === "base" ? "text-muted-foreground" : "font-semibold text-foreground")}>
        {currency} {money(amount)}
      </span>
    </span>
  );
}
