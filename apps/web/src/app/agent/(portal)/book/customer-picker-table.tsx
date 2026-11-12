"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import styles from "../workspace.module.css";
import design from "./booking-desk.module.css";

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export type PickerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  profile_id: string | null;
  bookings: number;
  lastBookingAt: string | null;
};

/** Single-customer booking is the default; group controls are opt-in. */
export function CustomerPickerTable({ rows, redirectTo, continueLabel = "Continue" }: {
  rows: PickerRow[];
  redirectTo?: string;
  continueLabel?: string;
}) {
  const [groupBooking, setGroupBooking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  // Only the customer being booked shows a loading indicator.
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
      <div className={design.listToolbar}>
        <span>{groupBooking ? "Select customers" : "Customer details"}</span>
        <Button
          variant={groupBooking ? "secondary" : "outline"}
          aria-pressed={groupBooking}
          disabled={pending}
          onClick={() => { setGroupBooking(!groupBooking); setSelected(new Set()); }}
        >
          <UsersRound className="size-4" aria-hidden="true" />Group booking
        </Button>
      </div>
      <div className={`${design.mobileList} sm:hidden`}>
        {groupBooking ? <label className="mb-2 flex min-h-10 items-center gap-3 text-xs text-muted-foreground">
          <Checkbox aria-label="Select all customers" disabled={pending} checked={allChecked} onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((row) => row.id)))} />
          Select all
        </label> : null}
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <li key={row.id} className={`${styles.customerMobileRow} ${design.customerRow}`} data-state={selected.has(row.id) ? "selected" : undefined}>
              {groupBooking ? <Checkbox aria-label={`Select ${row.full_name}`} disabled={pending} checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} /> : null}
              <span className={design.avatar} aria-hidden="true">{initials(row.full_name)}</span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{row.full_name}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{row.phone || row.email || "No contact on file"}</span>
              </div>
              {!groupBooking ? <Button size="sm" className={`${styles.customerSelect} ${design.continueButton}`} aria-label={`${continueLabel} for ${row.full_name}`} disabled={pending} loading={pending && pendingId === row.id} onClick={() => commit([row.id], row.id)}>{continueLabel}<ArrowRight className="size-3.5" aria-hidden="true" /></Button> : null}
            </li>
          ))}
        </ul>
      </div>
      <div className={`${design.tableWrap} hidden overflow-hidden sm:block`}>
        <Table className={`${styles.customerTable} ${design.customerTable}`}>
          <TableHeader>
            <TableRow>
              {groupBooking ? <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all"
                  disabled={pending}
                  checked={allChecked}
                  onCheckedChange={() =>
                    setSelected(allChecked ? new Set() : new Set(rows.map((row) => row.id)))
                  }
                />
              </TableHead> : null}
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              {!groupBooking ? <TableHead className={styles.customerActionHead}>Continue booking</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                {groupBooking ? <TableCell>
                  <Checkbox
                    aria-label={row.full_name}
                    disabled={pending}
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggle(row.id)}
                  />
                </TableCell> : null}
                <TableCell>
                  <span className={design.customerIdentity}>
                    <span className={design.avatar} aria-hidden="true">{initials(row.full_name)}</span>
                    <span className={design.customerName}>
                      <span className="font-semibold">{row.full_name}</span>
                      {row.profile_id ? <Badge variant="info">STS account</Badge> : null}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.phone || row.email || "No contact on file"}
                </TableCell>
                {!groupBooking ? <TableCell className={styles.customerActionCell}>
                  <Button
                    size="sm"
                    className={`${styles.customerSelect} ${design.continueButton}`}
                    aria-label={`${continueLabel} for ${row.full_name}`}
                    disabled={pending}
                    loading={pending && pendingId === row.id}
                    onClick={() => commit([row.id], row.id)}
                  >
                    {continueLabel}<ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {groupBooking && selected.size > 0 ? (
        <div className={styles.customerSelectionBar} role="region" aria-label="Selected customers">
          <span className={styles.customerSelectionCount} role="status"><Check className="size-4" aria-hidden="true" />{selected.size} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              disabled={pending}
              loading={pending && pendingId === null}
              onClick={() => commit([...selected])}
            >
              Continue with {selected.size} customer{selected.size === 1 ? "" : "s"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
