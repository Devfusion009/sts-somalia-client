"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { BedDouble, Plus, Search, Users, DollarSign, Lock, LogIn, LogOut, Pencil, ArrowLeftRight, Ban, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import {
  createFrontDeskBooking,
  checkInBooking,
  checkOutBooking,
  setBookingRoomLock,
  assignRoomUnit,
  updateBookingDetails,
  disableRoomUnit,
  rescheduleBooking,
  type FrontDeskActionState,
} from "@/modules/hotels/front-desk-actions";
import type { FrontDeskBar, FrontDeskDisabledRange, FrontDeskRoomType, FrontDeskStatus } from "@/modules/hotels/front-desk-queries";

const STATUS_LABEL: Record<FrontDeskStatus, string> = {
  reserved: "Reserved",
  confirmed_reserved: "Confirmed Reserved",
  check_in: "Check-in",
  occupied: "Occupied",
  due_out: "Due Out",
  check_out: "Check-out",
};

const STATUS_COLOR: Record<FrontDeskStatus, string> = {
  reserved: "bg-chart-2 text-white",
  confirmed_reserved: "bg-primary text-primary-foreground",
  check_in: "bg-brand-gold text-neutral-900",
  occupied: "bg-chart-4 text-white",
  due_out: "bg-chart-5 text-white",
  check_out: "bg-muted-foreground text-white",
};

const STATUS_DOT: Record<FrontDeskStatus, string> = {
  reserved: "bg-chart-2",
  confirmed_reserved: "bg-primary",
  check_in: "bg-brand-gold",
  occupied: "bg-chart-4",
  due_out: "bg-chart-5",
  check_out: "bg-muted-foreground",
};

type Cell =
  | { type: "empty"; span: 1; startIdx: number }
  | { type: "disabled"; span: number; reason: string | null; startIdx: number }
  | { type: "bar"; span: number; bar: FrontDeskBar; startIdx: number };

/** Turn a unit's bookings + disabled ranges into ordered, non-overlapping table cells across the visible dateList. */
function buildRowCells(dateList: string[], bars: FrontDeskBar[], disabled: FrontDeskDisabledRange[]): Cell[] {
  type Range = { start: string; end: string; kind: "bar" | "disabled"; bar?: FrontDeskBar; reason?: string | null };
  const ranges: Range[] = [
    ...bars.map((bar) => ({ start: bar.checkIn, end: bar.checkOut, kind: "bar" as const, bar })),
    ...disabled.map((d) => ({ start: d.dateStart, end: d.dateEnd, kind: "disabled" as const, reason: d.reason })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  const cells: Cell[] = [];
  let i = 0;
  for (const range of ranges) {
    let startIdx = dateList.indexOf(range.start);
    if (startIdx === -1) startIdx = range.start < dateList[0] ? 0 : dateList.length;
    let endIdx = dateList.indexOf(range.end);
    if (endIdx === -1) endIdx = range.end > dateList[dateList.length - 1] ? dateList.length : 0;

    startIdx = Math.max(startIdx, i);
    endIdx = Math.min(endIdx, dateList.length);
    if (endIdx <= startIdx) continue;

    while (i < startIdx) {
      cells.push({ type: "empty", span: 1, startIdx: i });
      i++;
    }
    const span = endIdx - startIdx;
    if (range.kind === "bar") cells.push({ type: "bar", span, bar: range.bar!, startIdx });
    else cells.push({ type: "disabled", span, reason: range.reason ?? null, startIdx });
    i = endIdx;
  }
  while (i < dateList.length) {
    cells.push({ type: "empty", span: 1, startIdx: i });
    i++;
  }
  return cells;
}

type DragMode = "create" | "move" | "resize-start" | "resize-end";

type DragState = {
  mode: DragMode;
  roomUnitId: string;
  roomTypeId: string;
  bookingId?: string;
  originStartIdx: number;
  originSpan: number;
  startClientX: number;
  columnWidth: number;
  deltaDays: number;
};

export function FrontDeskGrid({
  hotelId,
  roomTypes,
  bars,
  disabledRanges,
  dateList,
  canEdit,
}: {
  hotelId: string;
  roomTypes: FrontDeskRoomType[];
  bars: Record<string, FrontDeskBar[]>;
  disabledRanges: FrontDeskDisabledRange[];
  dateList: string[];
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const [roomTypeFilter, setRoomTypeFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<FrontDeskStatus>>(new Set());
  const [active, setActive] = useState<{ roomNumber: string; bar: FrontDeskBar; roomType: FrontDeskRoomType } | null>(null);
  const [editing, setEditing] = useState(false);
  const [addBooking, setAddBooking] = useState<{ open: boolean; prefill: { roomTypeId: string; checkIn: string; checkOut: string } | null }>({
    open: false,
    prefill: null,
  });

  // Drag-and-drop: create by dragging across empty cells, move an existing
  // bar, or resize it from either edge. dragRef holds the live state (mouse
  // events fire fast — a ref avoids a re-render per pixel); dragPreview is
  // the small, cheap-to-update piece that drives the floating tooltip.
  const dragRef = useRef<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{ clientX: number; clientY: number; label: string } | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [reschedulePending, setReschedulePending] = useState(false);

  const disabledByUnit = useMemo(() => {
    const map = new Map<string, FrontDeskDisabledRange[]>();
    for (const d of disabledRanges) {
      if (!map.has(d.roomUnitId)) map.set(d.roomUnitId, []);
      map.get(d.roomUnitId)!.push(d);
    }
    return map;
  }, [disabledRanges]);

  const tableRef = useRef<HTMLTableElement>(null);
  const firstColRef = useRef<HTMLTableCellElement>(null);

  function columnWidthPx() {
    const table = tableRef.current;
    const firstCol = firstColRef.current;
    if (!table || !firstCol || dateList.length === 0) return 112; // matches min-w-28
    return (table.getBoundingClientRect().width - firstCol.getBoundingClientRect().width) / dateList.length;
  }

  function addDaysToDate(iso: string, n: number) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  const beginDrag = useCallback(
    (mode: DragMode, roomUnitId: string, roomTypeId: string, originStartIdx: number, originSpan: number, clientX: number, bookingId?: string) => {
      dragRef.current = {
        mode,
        roomUnitId,
        roomTypeId,
        bookingId,
        originStartIdx,
        originSpan,
        startClientX: clientX,
        columnWidth: columnWidthPx(),
        deltaDays: 0,
      };
      setDragError(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateList.length]
  );

  const finalizeDrag = useCallback(
    (drag: DragState) => {
      if (drag.mode === "create") {
        const lo = Math.min(drag.originStartIdx, drag.originStartIdx + drag.deltaDays);
        const hi = Math.max(drag.originStartIdx, drag.originStartIdx + drag.deltaDays) + 1;
        const clampedLo = Math.max(0, lo);
        const clampedHi = Math.min(dateList.length, Math.max(hi, clampedLo + 1));
        setAddBooking({
          open: true,
          prefill: { roomTypeId: drag.roomTypeId, checkIn: dateList[clampedLo], checkOut: addDaysToDate(dateList[clampedHi - 1], 1) },
        });
        return;
      }

      if (!drag.bookingId) return;
      let newStartIdx = drag.originStartIdx;
      let newSpan = drag.originSpan;
      if (drag.mode === "move") {
        newStartIdx = Math.max(0, Math.min(dateList.length - drag.originSpan, drag.originStartIdx + drag.deltaDays));
      } else if (drag.mode === "resize-end") {
        newSpan = Math.max(1, Math.min(dateList.length - drag.originStartIdx, drag.originSpan + drag.deltaDays));
      } else if (drag.mode === "resize-start") {
        const proposedStart = Math.max(0, Math.min(drag.originStartIdx + drag.originSpan - 1, drag.originStartIdx + drag.deltaDays));
        newSpan = drag.originStartIdx + drag.originSpan - proposedStart;
        newStartIdx = proposedStart;
      }
      if (newStartIdx === drag.originStartIdx && newSpan === drag.originSpan) return;

      const newCheckIn = dateList[newStartIdx];
      const newCheckOut = addDaysToDate(dateList[newStartIdx + newSpan - 1], 1);
      const fd = new FormData();
      fd.set("bookingId", drag.bookingId);
      fd.set("checkIn", newCheckIn);
      fd.set("checkOut", newCheckOut);
      setReschedulePending(true);
      rescheduleBooking(null, fd)
        .then((result) => {
          if (result?.error) setDragError(result.error);
        })
        .finally(() => setReschedulePending(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateList]
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaDays = Math.round((e.clientX - drag.startClientX) / (drag.columnWidth || 1));
      drag.deltaDays = deltaDays;

      let label = "";
      if (drag.mode === "create") {
        const lo = Math.max(0, Math.min(drag.originStartIdx, drag.originStartIdx + deltaDays));
        const hi = Math.min(dateList.length - 1, Math.max(drag.originStartIdx, drag.originStartIdx + deltaDays));
        label = `${dateList[lo]} → ${addDaysToDate(dateList[hi], 1)}`;
      } else if (drag.mode === "move") {
        const newStart = Math.max(0, Math.min(dateList.length - drag.originSpan, drag.originStartIdx + deltaDays));
        label = `${dateList[newStart]} → ${addDaysToDate(dateList[newStart + drag.originSpan - 1], 1)}`;
      } else if (drag.mode === "resize-end") {
        const newSpan = Math.max(1, Math.min(dateList.length - drag.originStartIdx, drag.originSpan + deltaDays));
        label = `Check-out → ${addDaysToDate(dateList[drag.originStartIdx + newSpan - 1], 1)}`;
      } else {
        const proposedStart = Math.max(0, Math.min(drag.originStartIdx + drag.originSpan - 1, drag.originStartIdx + deltaDays));
        label = `Check-in → ${dateList[proposedStart]}`;
      }
      setDragPreview({ clientX: e.clientX, clientY: e.clientY, label });
    }
    function onMouseUp() {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setDragPreview(null);
      finalizeDrag(drag);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dateList, finalizeDrag]);

  const needle = search.trim().toLowerCase();

  function unitMatchesFilters(unitBars: FrontDeskBar[]) {
    if (!needle && roomTypeFilter.size === 0 && statusFilter.size === 0) return true;
    return unitBars.some((b) => {
      const matchesSearch =
        !needle ||
        b.guestName.toLowerCase().includes(needle) ||
        b.bookingId.toLowerCase().includes(needle) ||
        (b.bookingReference?.toLowerCase().includes(needle) ?? false) ||
        (b.guestEmail?.toLowerCase().includes(needle) ?? false);
      const matchesStatus = statusFilter.size === 0 || (b.status && statusFilter.has(b.status));
      return matchesSearch && matchesStatus;
    });
  }

  const visibleRoomTypes = roomTypes.filter((rt) => roomTypeFilter.size === 0 || roomTypeFilter.has(rt.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-2 ring-1 ring-foreground/10">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Booking ID, reference, guest name or email…"
            className="h-9 rounded-full border-transparent bg-secondary/60 pl-9 text-sm focus-visible:bg-card"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" className="h-9 rounded-full px-4" />}>
            Room type{roomTypeFilter.size > 0 ? ` (${roomTypeFilter.size})` : ""}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {roomTypes.map((rt) => (
              <DropdownMenuCheckboxItem
                key={rt.id}
                checked={roomTypeFilter.has(rt.id)}
                onCheckedChange={(checked) =>
                  setRoomTypeFilter((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(rt.id);
                    else next.delete(rt.id);
                    return next;
                  })
                }
              >
                {rt.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" className="h-9 rounded-full px-4" />}>
            Status{statusFilter.size > 0 ? ` (${statusFilter.size})` : ""}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(STATUS_LABEL) as FrontDeskStatus[]).map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statusFilter.has(s)}
                onCheckedChange={(checked) =>
                  setStatusFilter((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(s);
                    else next.delete(s);
                    return next;
                  })
                }
              >
                <span className={cn("mr-1.5 inline-block size-2 rounded-full", STATUS_DOT[s])} />
                {STATUS_LABEL[s]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3" /> Group
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="size-3" /> Payment pending
          </span>
          <span className="flex items-center gap-1">
            <Lock className="size-3" /> Stop room move
          </span>
        </div>

        {canEdit ? (
          <div className="ml-auto flex items-center gap-2">
            {reschedulePending ? <span className="text-xs text-muted-foreground">Moving…</span> : null}
            <Button size="sm" className="h-9 gap-1.5 rounded-full px-4 shadow-sm" onClick={() => setAddBooking({ open: true, prefill: null })}>
              <Plus className="size-4" /> Add Booking
            </Button>
          </div>
        ) : null}
      </div>

      {dragError ? (
        <Alert variant="destructive">
          <AlertDescription>{dragError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10">
        <table ref={tableRef} className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th ref={firstColRef} className="sticky left-0 z-10 min-w-32 border-b border-border bg-card px-4 py-3 text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Room
              </th>
              {dateList.map((date) => {
                const d = new Date(`${date}T00:00:00Z`);
                const today = date === new Date().toISOString().slice(0, 10);
                const weekend = [0, 5, 6].includes(d.getUTCDay());
                return (
                  <th
                    key={date}
                    className={cn(
                      "min-w-28 border-b border-l border-border px-2 py-2.5 text-center",
                      today ? "bg-primary/10" : weekend ? "bg-secondary/50" : "bg-card"
                    )}
                  >
                    <div className={cn("text-[11px] font-semibold tracking-wider uppercase", today ? "text-primary" : "text-muted-foreground")}>
                      {format(d, "EEE")}
                    </div>
                    <div className={cn("font-heading text-sm font-bold tabular-nums", today && "text-primary")}>{format(d, "d MMM")}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRoomTypes.map((rt) => (
              <RoomTypeSection
                key={rt.id}
                hotelId={hotelId}
                roomType={rt}
                dateList={dateList}
                bars={bars}
                disabledByUnit={disabledByUnit}
                unitMatchesFilters={unitMatchesFilters}
                onSelectBar={(roomNumber, bar) => setActive({ roomNumber, bar, roomType: rt })}
                canEdit={canEdit}
                onBeginDrag={beginDrag}
              />
            ))}
            {visibleRoomTypes.every((rt) => rt.units.length === 0) ? (
              <tr>
                <td colSpan={dateList.length + 1} className="px-3 py-14 text-center text-muted-foreground">
                  <BedDouble className="mx-auto mb-2 size-6 opacity-50" />
                  <span className="text-sm font-medium">No rooms added</span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {dragPreview ? (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg"
          style={{ left: dragPreview.clientX + 12, top: dragPreview.clientY + 12 }}
        >
          {dragPreview.label}
        </div>
      ) : null}

      <AddBookingDialog
        hotelId={hotelId}
        roomTypes={roomTypes}
        open={addBooking.open}
        prefill={addBooking.prefill}
        onOpenChange={(open) => setAddBooking((s) => ({ ...s, open }))}
      />

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="sm:max-w-md">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    Room No. {active.roomNumber}
                    {canEdit ? (
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setEditing(true)}>
                        <Pencil className="size-3" /> Edit
                      </Button>
                    ) : null}
                  </span>
                  {active.bar.status ? (
                    <Badge className={cn("border-transparent", STATUS_COLOR[active.bar.status])}>
                      {STATUS_LABEL[active.bar.status]}
                    </Badge>
                  ) : null}
                </DialogTitle>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Booking Duration</dt>
                  <dd className="font-semibold">
                    {active.bar.checkIn} → {active.bar.checkOut}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Guest</dt>
                  <dd className="font-semibold">{active.bar.guestName}</dd>
                  {active.bar.guestEmail ? <dd className="text-xs text-muted-foreground">{active.bar.guestEmail}</dd> : null}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Booking ID</dt>
                  <dd className="font-mono text-xs font-semibold">{active.bar.bookingId}</dd>
                </div>
                {active.bar.bookingReference ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Reference</dt>
                    <dd className="font-mono text-xs font-semibold">{active.bar.bookingReference}</dd>
                  </div>
                ) : null}
                {active.bar.paymentMethod ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Payment Type</dt>
                    <dd className="font-semibold">{active.bar.paymentMethod}</dd>
                  </div>
                ) : null}
                {active.bar.notes ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Notes</dt>
                    <dd className="text-sm">{active.bar.notes}</dd>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {active.bar.isGroupBooking ? (
                    <Badge variant="outline" className="gap-1">
                      <Users className="size-3" /> Group
                    </Badge>
                  ) : null}
                  {active.bar.paymentPending ? (
                    <Badge variant="outline" className="gap-1 text-brand-gold">
                      <DollarSign className="size-3" /> Payment pending
                    </Badge>
                  ) : null}
                  {active.bar.locked ? (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="size-3" /> Stop room move
                    </Badge>
                  ) : null}
                </div>
              </dl>

              {canEdit ? (
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="flex flex-wrap gap-2">
                    {!active.bar.status || active.bar.status === "confirmed_reserved" || active.bar.status === "check_in" ? (
                      <form action={checkInBooking}>
                        <input type="hidden" name="bookingId" value={active.bar.bookingId} />
                        <Button size="sm" type="submit" className="gap-1.5">
                          <LogIn className="size-3.5" /> Check In
                        </Button>
                      </form>
                    ) : null}
                    {active.bar.status === "occupied" || active.bar.status === "due_out" ? (
                      <form action={checkOutBooking}>
                        <input type="hidden" name="bookingId" value={active.bar.bookingId} />
                        <Button size="sm" type="submit" variant="outline" className="gap-1.5">
                          <LogOut className="size-3.5" /> Check Out
                        </Button>
                      </form>
                    ) : null}
                    <form action={setBookingRoomLock}>
                      <input type="hidden" name="bookingId" value={active.bar.bookingId} />
                      <input type="hidden" name="locked" value={active.bar.locked ? "false" : "true"} />
                      <Button size="sm" type="submit" variant="ghost" className="gap-1.5">
                        <Lock className="size-3.5" /> {active.bar.locked ? "Allow room move" : "Stop room move"}
                      </Button>
                    </form>
                  </div>
                  <ReallocateForm bookingId={active.bar.bookingId} roomType={active.roomType} currentUnitId={active.bar.roomUnitId} />
                </div>
              ) : null}

              <DialogFooter>
                <Button variant="outline" onClick={() => setActive(null)} className="gap-1.5">
                  <X className="size-3.5" /> Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {active ? (
        <EditBookingDialog open={editing} onOpenChange={setEditing} bar={active.bar} currency={active.roomType.currency} />
      ) : null}
    </div>
  );
}

function RoomTypeSection({
  hotelId,
  roomType,
  dateList,
  bars,
  disabledByUnit,
  unitMatchesFilters,
  onSelectBar,
  canEdit,
  onBeginDrag,
}: {
  hotelId: string;
  roomType: FrontDeskRoomType;
  dateList: string[];
  bars: Record<string, FrontDeskBar[]>;
  disabledByUnit: Map<string, FrontDeskDisabledRange[]>;
  unitMatchesFilters: (unitBars: FrontDeskBar[]) => boolean;
  onSelectBar: (roomNumber: string, bar: FrontDeskBar) => void;
  canEdit: boolean;
  onBeginDrag: (mode: DragMode, roomUnitId: string, roomTypeId: string, originStartIdx: number, originSpan: number, clientX: number, bookingId?: string) => void;
}) {
  const visibleUnits = roomType.units.filter((u) => unitMatchesFilters(bars[u.id] ?? []));

  return (
    <>
      <tr className="bg-secondary/40">
        <th className="sticky left-0 z-10 border-t border-border bg-secondary px-4 py-2.5 text-left text-sm font-semibold">{roomType.name}</th>
        {roomType.dates.map((d) => {
          const sold = d.total > 0 ? Math.min(1, Math.max(0, (d.total - d.available) / d.total)) : 0;
          const bar = d.available === 0 ? "bg-destructive" : sold >= 0.75 ? "bg-brand-gold" : "bg-primary";
          return (
            <td key={d.date} className="border-t border-l border-border bg-secondary/40 px-3 py-2 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-heading text-sm font-bold tabular-nums">{d.available}</span>
                <span className="text-muted-foreground tabular-nums">/ {d.total}</span>
              </div>
              <div className="mx-auto mt-1 h-1 w-full max-w-16 overflow-hidden rounded-full bg-foreground/10">
                <div className={cn("h-full rounded-full", bar)} style={{ width: `${sold * 100}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                {roomType.currency} {d.price.toFixed(0)}
              </div>
            </td>
          );
        })}
      </tr>
      {visibleUnits.map((unit) => {
        const cells = buildRowCells(dateList, bars[unit.id] ?? [], disabledByUnit.get(unit.id) ?? []);
        return (
          <tr key={unit.id}>
            <td className="sticky left-0 z-10 flex items-center justify-between gap-1 border-t border-border bg-card px-4 py-2 font-medium">
              <span>
                {unit.roomNumber}
                {unit.floor ? <span className="text-muted-foreground"> · F{unit.floor}</span> : null}
              </span>
              {canEdit ? <DisableRoomButton hotelId={hotelId} roomUnitId={unit.id} roomNumber={unit.roomNumber} /> : null}
            </td>
            {cells.map((cell, idx) =>
              cell.type === "empty" ? (
                <td
                  key={idx}
                  className={cn("border-t border-l border-border", canEdit && "cursor-crosshair")}
                  onMouseDown={
                    canEdit
                      ? (e) => onBeginDrag("create", unit.id, roomType.id, cell.startIdx, 1, e.clientX)
                      : undefined
                  }
                />
              ) : cell.type === "disabled" ? (
                <td key={idx} colSpan={cell.span} className="border-t border-l border-border bg-muted px-2 py-1.5 text-center text-muted-foreground">
                  Out of order
                </td>
              ) : (
                <td key={idx} colSpan={cell.span} className="relative border-t border-l border-border p-0.5">
                  <button
                    type="button"
                    onClick={() => onSelectBar(unit.roomNumber, cell.bar)}
                    onMouseDown={
                      canEdit && !cell.bar.locked
                        ? (e) => {
                            e.preventDefault();
                            onBeginDrag("move", unit.id, roomType.id, cell.startIdx, cell.span, e.clientX, cell.bar.bookingId);
                          }
                        : undefined
                    }
                    className={cn(
                      "flex w-full items-center gap-1 rounded px-1.5 py-1 text-left font-medium",
                      canEdit && !cell.bar.locked && "cursor-grab active:cursor-grabbing",
                      cell.bar.status ? STATUS_COLOR[cell.bar.status] : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="truncate">{cell.bar.guestName}</span>
                    {cell.bar.isGroupBooking ? <Users className="size-3 shrink-0" /> : null}
                    {cell.bar.paymentPending ? <DollarSign className="size-3 shrink-0" /> : null}
                    {cell.bar.locked ? <Lock className="size-3 shrink-0" /> : null}
                  </button>
                  {canEdit && !cell.bar.locked ? (
                    <>
                      <div
                        className="absolute top-0 left-0.5 h-full w-2 cursor-ew-resize"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onBeginDrag("resize-start", unit.id, roomType.id, cell.startIdx, cell.span, e.clientX, cell.bar.bookingId);
                        }}
                      />
                      <div
                        className="absolute top-0 right-0.5 h-full w-2 cursor-ew-resize"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onBeginDrag("resize-end", unit.id, roomType.id, cell.startIdx, cell.span, e.clientX, cell.bar.bookingId);
                        }}
                      />
                    </>
                  ) : null}
                </td>
              )
            )}
          </tr>
        );
      })}
    </>
  );
}

/**
 * Book Rooms — room type + quantity, reserved via the same allocator every
 * other booking path uses. Controlled (not self-triggered): the toolbar's
 * Add Booking button and a drag-to-create gesture on an empty row both open
 * this, the second one pre-filled with the dragged room type and dates.
 */
function AddBookingDialog({
  hotelId,
  roomTypes,
  open,
  prefill,
  onOpenChange,
}: {
  hotelId: string;
  roomTypes: FrontDeskRoomType[];
  open: boolean;
  prefill: { roomTypeId: string; checkIn: string; checkOut: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction] = useActionState<FrontDeskActionState, FormData>(createFrontDeskBooking, null);
  const [roomTypeId, setRoomTypeId] = useState(prefill?.roomTypeId ?? roomTypes[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(prefill?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(prefill?.checkOut ?? "");
  const today = new Date().toISOString().slice(0, 10);

  // Re-seed the form fields whenever a new prefill arrives (a fresh drag,
  // or the toolbar button clearing it) — not on every render.
  const lastPrefill = useRef(prefill);
  if (prefill !== lastPrefill.current) {
    lastPrefill.current = prefill;
    setRoomTypeId(prefill?.roomTypeId ?? roomTypes[0]?.id ?? "");
    setCheckIn(prefill?.checkIn ?? "");
    setCheckOut(prefill?.checkOut ?? "");
  }

  const selectedRoomType = roomTypes.find((rt) => rt.id === roomTypeId);
  const availableForCheckIn = selectedRoomType?.dates.find((d) => d.date === checkIn)?.available;

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Book Rooms</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="checkIn">Check In Date</Label>
              <Input id="checkIn" name="checkIn" type="date" min={today} required value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkOut">Check Out Date</Label>
              <Input id="checkOut" name="checkOut" type="date" min={checkIn || today} required value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Room Type</Label>
            <input type="hidden" name="roomTypeId" value={roomTypeId} />
            <Select value={roomTypeId} onValueChange={(v) => setRoomTypeId(String(v ?? ""))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roomTypes.map((rt) => (
                  <SelectItem key={rt.id} value={rt.id}>
                    {rt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {checkIn && availableForCheckIn !== undefined ? (
              <p className="text-xs text-muted-foreground">Rooms Available: {availableForCheckIn}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="numRooms">Number of Rooms</Label>
            <Input id="numRooms" name="numRooms" type="number" min={1} max={20} defaultValue={1} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <SubmitButton pendingText="Booking…">Book Rooms</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Disable Room — block one physical room for a date range (maintenance etc.). */
function DisableRoomButton({ hotelId, roomUnitId, roomNumber }: { hotelId: string; roomUnitId: string; roomNumber: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FrontDeskActionState, FormData>(disableRoomUnit, null);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" className="size-6 shrink-0 text-muted-foreground" />}>
        <Ban className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Disable Room {roomNumber}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomUnitId" value={roomUnitId} />
          {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dateStart">From</Label>
              <Input id="dateStart" name="dateStart" type="date" min={today} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateEnd">Back on</Label>
              <Input id="dateEnd" name="dateEnd" type="date" min={today} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" name="reason" placeholder="Maintenance…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <SubmitButton pendingText="Disabling…">Disable Room</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Reallocate/Swap — assign this booking to a different physical room of the same type. */
function ReallocateForm({
  bookingId,
  roomType,
  currentUnitId,
}: {
  bookingId: string;
  roomType: FrontDeskRoomType;
  currentUnitId: string;
}) {
  const [state, formAction] = useActionState<FrontDeskActionState, FormData>(assignRoomUnit, null);
  const [roomUnitId, setRoomUnitId] = useState(currentUnitId);
  const otherUnits = roomType.units.filter((u) => u.id !== currentUnitId);

  if (otherUnits.length === 0) return null;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="roomUnitId" value={roomUnitId} />
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex items-center gap-2">
        <Select value={roomUnitId} onValueChange={(v) => setRoomUnitId(String(v ?? currentUnitId))}>
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={currentUnitId}>Current room</SelectItem>
            {otherUnits.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.roomNumber}
                {u.floor ? ` · F${u.floor}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SubmitButton size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" pendingText="Moving…">
          <ArrowLeftRight className="size-3.5" /> Reallocate/Swap
        </SubmitButton>
      </div>
    </form>
  );
}

/** Edit modal — price and occupancy only. Dates aren't editable here on purpose; see front-desk-actions.ts. */
function EditBookingDialog({
  open,
  onOpenChange,
  bar,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bar: FrontDeskBar;
  currency: string;
}) {
  const [state, formAction] = useActionState<FrontDeskActionState, FormData>(updateBookingDetails, null);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bar.bookingId} />
          {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="checkIn">Check-In</Label>
              <Input id="checkIn" name="checkIn" type="date" defaultValue={bar.checkIn} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkOut">Check-Out</Label>
              <Input id="checkOut" name="checkOut" type="date" defaultValue={bar.checkOut} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-1.5">
              <Label htmlFor="totalPrice">Price ({currency})</Label>
              <Input id="totalPrice" name="totalPrice" type="number" min={0} step="0.01" defaultValue={bar.totalPrice} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="numAdults">Adults</Label>
              <Input id="numAdults" name="numAdults" type="number" min={1} max={30} defaultValue={bar.numAdults} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="numChildren">Children</Label>
              <Input id="numChildren" name="numChildren" type="number" min={0} max={30} defaultValue={bar.numChildren} required />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <SubmitButton pendingText="Saving…">Update</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
