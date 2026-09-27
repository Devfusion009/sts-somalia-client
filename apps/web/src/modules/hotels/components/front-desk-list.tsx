"use client";

import { useMemo, useState } from "react";
import { LogIn, LogOut, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border !py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <Badge variant="secondary">{bookings.length}</Badge>
        </CardTitle>
        {bookings.length > 0 ? (
          <div className="relative w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guest"
              className="h-8 pl-8 pr-7 text-sm"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {bookings.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Adults</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>
                    {mode === "arriving" ? "Check-out" : "Check-in"}
                  </TableHead>
                  <TableHead className="text-right">
                    {mode === "arriving" ? "Registration" : "Departure"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No guests match “{query}”.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => {
                    const registered =
                      mode === "arriving"
                        ? b.checked_in_at !== null
                        : b.checked_out_at !== null;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">
                          {hotelGuestNames(b.guest_details)[0] ?? "Guest"}
                        </TableCell>
                        <TableCell>{b.num_adults}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {b.hotel_rooms?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {mode === "arriving" ? b.check_out : b.check_in}
                        </TableCell>
                        <TableCell className="text-right">
                          {!canEdit ? null : registered ? (
                            <span className="text-xs text-muted-foreground">
                              {mode === "arriving"
                                ? "Checked in"
                                : "Checked out"}
                            </span>
                          ) : mode === "arriving" ? (
                            <form action={checkInBooking}>
                              <input
                                type="hidden"
                                name="bookingId"
                                value={b.id}
                              />
                              <Button
                                type="submit"
                                size="sm"
                                className="gap-1.5"
                              >
                                <LogIn className="size-3.5" /> Check in
                              </Button>
                            </form>
                          ) : (
                            <form action={checkOutBooking}>
                              <input
                                type="hidden"
                                name="bookingId"
                                value={b.id}
                              />
                              <Button
                                type="submit"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                              >
                                <LogOut className="size-3.5" /> Check out
                              </Button>
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
