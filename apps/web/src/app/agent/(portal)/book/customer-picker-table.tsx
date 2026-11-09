"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { selectBookingCustomers } from "@/modules/agencies/booking-context-actions";

export type PickerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  profile_id: string | null;
  bookings: number;
  lastBookingAt: string | null;
};

/**
 * One customer is the common case and stays a single click ("Select"). The
 * checkboxes are for the case that actually needs the desk — a group going
 * on one departure — where the same product is booked for everyone at once.
 */
export function CustomerPickerTable({ rows, redirectTo }: { rows: PickerRow[]; redirectTo?: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  // Which row's "Select" was clicked, so only that button shows the spinner.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();

  const allChecked = rows.length > 0 && rows.every((row) => selected.has(row.id));

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function commit(ids: string[], rowId: string | null = null) {
    setPendingId(rowId);
    startTransition(async () => {
      const result = await selectBookingCustomers(ids);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <>
      <div className="sm:hidden">
        <label className="mb-2 flex min-h-10 items-center gap-3 text-xs text-muted-foreground">
          <Checkbox aria-label="Select all customers" checked={allChecked} onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((row) => row.id)))} />
          Select all
        </label>
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <li key={row.id} className={`flex items-center gap-3 py-4 ${selected.has(row.id) ? "bg-accent" : ""}`}>
              <Checkbox aria-label={`Select ${row.full_name}`} checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{row.full_name}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{row.phone ?? row.email ?? "—"}</span>
              </div>
              <Button size="sm" variant="outline" disabled={pending} loading={pending && pendingId === row.id} onClick={() => commit([row.id], row.id)}>Select</Button>
            </li>
          ))}
        </ul>
      </div>
      <Card className="hidden overflow-hidden py-0 sm:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all"
                    checked={allChecked}
                    onCheckedChange={() =>
                      setSelected(allChecked ? new Set() : new Set(rows.map((row) => row.id)))
                    }
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead numeric>Bookings</TableHead>
                <TableHead numeric>Last booking</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={row.full_name}
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggle(row.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{row.full_name}</span>
                      {row.profile_id ? <Badge variant="info">STS account</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.phone ?? row.email ?? "—"}
                  </TableCell>
                  <TableCell numeric className="text-sm">
                    <Badge variant="neutral" className="tabular-nums">{row.bookings}</Badge>
                  </TableCell>
                  <TableCell numeric className="text-sm text-muted-foreground">
                    {row.lastBookingAt ? format(new Date(row.lastBookingAt), "d MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      loading={pending && pendingId === row.id}
                      onClick={() => commit([row.id], row.id)}
                    >
                      Select
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {selected.size > 0 ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-md ring-1 ring-foreground/10">
          <span className="text-sm font-medium tabular-nums">{selected.size} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              disabled={pending}
              loading={pending && pendingId === null}
              onClick={() => commit([...selected])}
            >
              Continue with {selected.size} customer{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
