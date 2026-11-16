"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ArrowRight, TriangleAlert, UsersRound, X } from "lucide-react";
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
import { countryName } from "@/lib/countries";
import { selectBookingCustomers } from "@/modules/agencies/booking-context-actions";
import {
  MAX_BATCH_CUSTOMERS,
  passportStatus,
  travellerReady,
} from "@/modules/agencies/traveller-profile";
import styles from "../workspace.module.css";
import design from "./booking-desk.module.css";

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function day(value: string) {
  return format(parseISO(value), "d MMM yyyy");
}

export type PickerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  profile_id: string | null;
  bookings: number;
  lastBookingAt: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  passport_number?: string | null;
  passport_expiry_date?: string | null;
};

type Picked = { id: string; name: string; ready: boolean };

/*
 * The selection outlives a page of results: a group is assembled across
 * searches and pages (the directory pages at 25, a group runs to 40), so it
 * lives in sessionStorage behind a tiny external store rather than in
 * component state that a search or page change would reset.
 */
const STORE_KEY = "sts-desk-travellers";
const NONE: Picked[] = [];
let snapshot: Picked[] | null = null;
const listeners = new Set<() => void>();

function isPicked(value: unknown): value is Picked {
  const item = value as Picked;
  return typeof item?.id === "string" && typeof item.name === "string" && typeof item.ready === "boolean";
}

function readSelection(): Picked[] {
  if (snapshot) return snapshot;
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(STORE_KEY) ?? "[]");
    snapshot = Array.isArray(parsed) ? parsed.filter(isPicked).slice(0, MAX_BATCH_CUSTOMERS) : NONE;
  } catch {
    snapshot = NONE;
  }
  return snapshot;
}

function writeSelection(next: Picked[]) {
  snapshot = next;
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or blocked storage: the selection still works for this page.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function pick(row: PickerRow): Picked {
  return { id: row.id, name: row.full_name, ready: travellerReady(row) };
}

function TravellerFacts({ row }: { row: PickerRow }) {
  if (!travellerReady(row)) {
    return (
      <Link href={`/agent/customers/${row.id}`} className={design.completeLink}>
        <TriangleAlert aria-hidden="true" />Complete profile
      </Link>
    );
  }
  const facts = [
    row.gender ? row.gender[0].toUpperCase() + row.gender.slice(1) : null,
    row.date_of_birth ? day(row.date_of_birth) : null,
    row.nationality ? countryName(row.nationality) : null,
  ].filter(Boolean);
  return <span className={design.travellerFacts}>{facts.join(" · ")}</span>;
}

function Passport({ row }: { row: PickerRow }) {
  if (!row.passport_number) return <Badge variant="warning">Missing</Badge>;
  const status = passportStatus(row.passport_expiry_date);
  return (
    <span className={design.passport}>
      <span className={design.passportNumber}>{row.passport_number}</span>
      <span className={design.passportExpiry} data-status={status}>
        {row.passport_expiry_date
          ? `${status === "expired" ? "Expired" : "Exp"} ${day(row.passport_expiry_date)}`
          : "Expiry missing"}
      </span>
    </span>
  );
}

/**
 * Tick any number of travellers (across searches and pages) for one group
 * booking, or use a row's Continue for a single traveller.
 */
export function CustomerPickerTable({ rows, redirectTo, continueLabel = "Continue" }: {
  rows: PickerRow[];
  redirectTo?: string;
  continueLabel?: string;
}) {
  const picked = useSyncExternalStore(subscribe, readSelection, () => NONE);
  const [pending, startTransition] = useTransition();
  // Only the customer being booked shows a loading indicator.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();

  const pickedIds = new Set(picked.map((item) => item.id));
  const atLimit = picked.length >= MAX_BATCH_CUSTOMERS;
  const allOnPage = rows.length > 0 && rows.every((row) => pickedIds.has(row.id));
  // Rows on screen carry the freshest profile; the stored flag covers the rest.
  const current = new Map(rows.map((row) => [row.id, row]));
  const incomplete = picked.filter((item) => {
    const row = current.get(item.id);
    return row ? !travellerReady(row) : !item.ready;
  }).length;

  function toggle(row: PickerRow) {
    if (pickedIds.has(row.id)) {
      writeSelection(picked.filter((item) => item.id !== row.id));
    } else if (atLimit) {
      toast.error(`Up to ${MAX_BATCH_CUSTOMERS} travellers per booking.`);
    } else {
      writeSelection([...picked, pick(row)]);
    }
  }

  function togglePage() {
    if (allOnPage) {
      const onPage = new Set(rows.map((row) => row.id));
      writeSelection(picked.filter((item) => !onPage.has(item.id)));
      return;
    }
    const added = rows.filter((row) => !pickedIds.has(row.id)).map(pick);
    const room = MAX_BATCH_CUSTOMERS - picked.length;
    if (added.length > room) toast.error(`Up to ${MAX_BATCH_CUSTOMERS} travellers per booking.`);
    writeSelection([...picked, ...added.slice(0, Math.max(room, 0))]);
  }

  function commit(ids: string[], rowId: string | null = null) {
    setPendingId(rowId);
    startTransition(async () => {
      const result = await selectBookingCustomers(ids);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      writeSelection(NONE);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  const pageCheckbox = (
    <Checkbox
      aria-label="Select all on this page"
      disabled={pending || (atLimit && !allOnPage)}
      checked={allOnPage}
      onCheckedChange={togglePage}
    />
  );

  return (
    <>
      <div className={`${design.mobileList} sm:hidden`}>
        <label className="mb-2 flex min-h-10 items-center gap-3 text-xs font-medium text-muted-foreground">
          {pageCheckbox}
          Select all
        </label>
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((row) => {
            const selected = pickedIds.has(row.id);
            return (
              <li key={row.id} className={`${styles.customerMobileRow} ${design.customerRow}`} data-state={selected ? "selected" : undefined}>
                <Checkbox
                  aria-label={`Select ${row.full_name}`}
                  disabled={pending || (atLimit && !selected)}
                  checked={selected}
                  onCheckedChange={() => toggle(row)}
                />
                <span className={design.avatar} aria-hidden="true">{initials(row.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{row.full_name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{row.phone || row.email || "No contact on file"}</span>
                  <TravellerFacts row={row} />
                </div>
                <Button size="sm" className={`${styles.customerSelect} ${design.continueButton}`} aria-label={`${continueLabel} for ${row.full_name}`} disabled={pending} loading={pending && pendingId === row.id} onClick={() => commit([row.id], row.id)}>{continueLabel}<ArrowRight className="size-3.5" aria-hidden="true" /></Button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={`${design.tableWrap} hidden overflow-hidden sm:block`}>
        <Table className={`${styles.customerTable} ${design.customerTable}`}>
          <TableHeader>
            <TableRow>
              <TableHead className={design.checkCell}>{pageCheckbox}</TableHead>
              <TableHead>Traveller</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Passport</TableHead>
              <TableHead className={styles.customerActionHead}>Continue booking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const selected = pickedIds.has(row.id);
              return (
                <TableRow key={row.id} data-state={selected ? "selected" : undefined}>
                  <TableCell className={design.checkCell}>
                    <Checkbox
                      aria-label={`Select ${row.full_name}`}
                      disabled={pending || (atLimit && !selected)}
                      checked={selected}
                      onCheckedChange={() => toggle(row)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className={design.customerIdentity}>
                      <span className={design.avatar} aria-hidden="true">{initials(row.full_name)}</span>
                      <span className="min-w-0">
                        <span className={design.customerName}>
                          <span className="font-semibold">{row.full_name}</span>
                          {row.profile_id ? <Badge variant="info">STS account</Badge> : null}
                        </span>
                        <TravellerFacts row={row} />
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.phone || row.email || "No contact on file"}
                  </TableCell>
                  <TableCell>
                    <Passport row={row} />
                  </TableCell>
                  <TableCell className={styles.customerActionCell}>
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {picked.length > 0 ? (
        <div className={design.selectionBar} role="region" aria-label="Selected travellers">
          <div className={design.selectionSummary}>
            <span className={design.selectionCount} role="status">
              <UsersRound aria-hidden="true" />
              <span><strong>{picked.length}</strong> / {MAX_BATCH_CUSTOMERS}</span>
            </span>
            <ul className={design.selectionChips}>
              {picked.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <button type="button" aria-label={`Remove ${item.name}`} disabled={pending} onClick={() => writeSelection(picked.filter((other) => other.id !== item.id))}>
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
              {picked.length > 4 ? <li className={design.moreChip}>+{picked.length - 4}</li> : null}
            </ul>
            {incomplete > 0 ? (
              <span className={design.selectionWarning}>
                <TriangleAlert aria-hidden="true" />{incomplete} incomplete
              </span>
            ) : null}
          </div>
          <div className={design.selectionActions}>
            <Button variant="ghost" disabled={pending} onClick={() => writeSelection(NONE)}>
              Clear
            </Button>
            <Button
              disabled={pending}
              loading={pending && pendingId === null}
              onClick={() => commit(picked.map((item) => item.id))}
            >
              Continue with {picked.length} traveller{picked.length === 1 ? "" : "s"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
