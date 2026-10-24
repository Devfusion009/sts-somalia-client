"use client";

import { useMemo, useState } from "react";
import { LogIn, LogOut, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SubmitButton } from "@/components/submit-button";
import { shortDate } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  checkInBooking,
  checkOutBooking,
} from "@/modules/hotels/front-desk-actions";
import { hotelGuestNames } from "@/modules/orders/format";

export type FrontDeskBooking = {
  id: string;
  check_in: string;
  check_out: string;
  num_adults: number;
  checked_in_at: string | null;
  checked_out_at: string | null;
  guest_details: unknown;
  hotel_rooms: { name: string } | null;
};

/**
 * Arriving/Departing panel: search-filtered by guest name, one action per
 * row (check the guest in on arrival, out on departure) wired to the same
 * checkInBooking/checkOutBooking actions the Front Desk board uses — this is
 * a second, faster path to the same physical check-in, not a separate status.
 */
export function FrontDeskList({
  title,
  emptyLabel,
  bookings,
  mode,
  canEdit,
}: {
  title: string;
  emptyLabel: string;
  bookings: FrontDeskBooking[];
  mode: "arriving" | "departing";
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) =>
      (hotelGuestNames(b.guest_details)[0] ?? "").toLowerCase().includes(q),
    );
  }, [bookings, query]);

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b border-border pt-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <Badge variant="secondary" className="tabular-nums">
            {bookings.length}
          </Badge>
        </CardTitle>
        {bookings.length > 0 ? (
          <CardAction className="w-40 sm:w-48">
            <InputGroup className="h-8 max-sm:h-10">
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guest"
                aria-label={`Search ${title.toLowerCase()}`}
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQuery("")}>
                    <X aria-hidden="true" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {bookings.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">{mode === "arriving" ? <LogIn /> : <LogOut />}</EmptyMedia>
            <EmptyTitle>{emptyLabel}</EmptyTitle>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Guest</TableHead>
                  <TableHead className="text-right">Adults</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>{mode === "arriving" ? "Check-out" : "Check-in"}</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No match for “{query}”
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => {
                    const registered = mode === "arriving" ? b.checked_in_at !== null : b.checked_out_at !== null;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="pl-4 font-medium">{hotelGuestNames(b.guest_details)[0] ?? "Guest"}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.num_adults}</TableCell>
                        <TableCell className="text-muted-foreground">{b.hotel_rooms?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {shortDate(mode === "arriving" ? b.check_out : b.check_in)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          {!canEdit ? null : registered ? (
                            <Badge variant={mode === "arriving" ? "success" : "neutral"}>
                              {mode === "arriving" ? "Checked in" : "Checked out"}
                            </Badge>
                          ) : mode === "arriving" ? (
                            <form action={checkInBooking}>
                              <input type="hidden" name="bookingId" value={b.id} />
                              <SubmitButton size="sm" pendingText="Checking in…">
                                <LogIn aria-hidden="true" /> Check in
                              </SubmitButton>
                            </form>
                          ) : (
                            <form action={checkOutBooking}>
                              <input type="hidden" name="bookingId" value={b.id} />
                              <SubmitButton size="sm" variant="outline" pendingText="Checking out…">
                                <LogOut aria-hidden="true" /> Check out
                              </SubmitButton>
                            </form>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
