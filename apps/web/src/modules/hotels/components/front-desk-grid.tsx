"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { BedDouble, Plus, Search, Users, DollarSign, Lock, LogIn, LogOut, Pencil, ArrowLeftRight, Ban, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/submit-button";
import { dateSpan } from "@/lib/money";
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

// Filled bars are committed stays; a reserved (unconfirmed) booking is a
// hollow bar, and arrival/departure states carry an icon, so status never
// rests on color alone.
const STATUS_COLOR: Record<FrontDeskStatus, string> = {
  reserved: "bg-chart-2/10 text-foreground ring-1 ring-inset ring-chart-2",
  confirmed_reserved: "bg-primary text-primary-foreground",
  check_in: "bg-brand-gold text-neutral-900",
  occupied: "bg-chart-4 text-white",
  due_out: "bg-chart-5 text-white",
  check_out: "bg-muted-foreground text-white",
};

const STATUS_DOT: Record<FrontDeskStatus, string> = {
  reserved: "bg-chart-2/10 ring-1 ring-inset ring-chart-2",
  confirmed_reserved: "bg-primary",
  check_in: "bg-brand-gold",
  occupied: "bg-chart-4",
  due_out: "bg-chart-5",
  check_out: "bg-muted-foreground",
};

const STATUS_ICON: Partial<Record<FrontDeskStatus, LucideIcon>> = {
  check_in: LogIn,
  due_out: LogOut,
};

/** Opaque tints for sticky header cells (translucent ones let scrolled rows show through). */
const TODAY_HEAD = "bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] shadow-[inset_0_2px_0_var(--primary)]";
const WEEKEND_HEAD = "bg-[color-mix(in_oklch,var(--secondary)_50%,var(--card))]";

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

  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-0 flex-1 basis-full sm:max-w-sm sm:basis-auto max-sm:h-10">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Booking ID, reference, guest or email"
            aria-label="Search bookings"
          />
        </InputGroup>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" className="tabular-nums" />}>
            Room type
            {roomTypeFilter.size > 0 ? <Badge variant="secondary">{roomTypeFilter.size}</Badge> : null}
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
          <DropdownMenuTrigger render={<Button variant="outline" className="tabular-nums" />}>
            Status
            {statusFilter.size > 0 ? <Badge variant="secondary">{statusFilter.size}</Badge> : null}
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
                <span aria-hidden="true" className={cn("mr-1.5 inline-block size-2.5 rounded-sm", STATUS_DOT[s])} />
                {STATUS_LABEL[s]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {canEdit ? (
          <div className="ml-auto flex items-center gap-2">
            {reschedulePending ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Spinner className="size-3.5" /> Moving
              </span>
            ) : null}
            <Button onClick={() => setAddBooking({ open: true, prefill: null })}>
              <Plus aria-hidden="true" /> Add booking
            </Button>
          </div>
        ) : null}
      </div>

      {dragError ? (
        <Alert variant="destructive">
          <AlertDescription>{dragError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="max-h-[calc(100dvh-14rem)] min-h-64 overflow-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table ref={tableRef} className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th
                ref={firstColRef}
                scope="col"
                className="sticky top-0 left-0 z-30 min-w-32 border-b border-border bg-card px-4 py-3 text-left text-xs font-medium text-muted-foreground"
              >
                Room
              </th>
              {dateList.map((date) => {
                const d = new Date(`${date}T00:00:00Z`);
                const today = date === todayDate;
                const weekend = [0, 5, 6].includes(d.getUTCDay());
                return (
                  <th
                    key={date}
                    scope="col"
                    aria-current={today ? "date" : undefined}
                    className={cn(
                      "sticky top-0 z-20 min-w-28 border-b border-l border-border px-2 py-2.5 text-center",
                      today ? TODAY_HEAD : weekend ? WEEKEND_HEAD : "bg-card"
                    )}
                  >
                    <div className={cn("text-xs font-medium", today ? "font-semibold text-primary" : "text-muted-foreground")}>
                      {today ? "Today" : format(d, "EEE")}
                    </div>
                    <div className={cn("font-heading text-sm font-semibold tabular-nums", today && "text-primary")}>
                      {format(d, "d MMM")}
                    </div>
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
                todayDate={todayDate}
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
                <td colSpan={dateList.length + 1} className="p-0">
                  <div className="sticky left-0 max-w-[calc(100vw-2rem)]">
                    <Empty>
                      <EmptyMedia variant="icon">
                        <BedDouble />
                      </EmptyMedia>
                      <EmptyTitle>No rooms added</EmptyTitle>
                    </Empty>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {(Object.keys(STATUS_LABEL) as FrontDeskStatus[]).map((s) => {
          const Icon = STATUS_ICON[s];
          return (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("inline-block size-2.5 rounded-sm", STATUS_DOT[s])} />
              {Icon ? <Icon aria-hidden="true" className="size-3" /> : null}
              {STATUS_LABEL[s]}
            </li>
          );
        })}
        <li className="flex items-center gap-1.5">
          <Users aria-hidden="true" className="size-3" /> Group
        </li>
        <li className="flex items-center gap-1.5">
          <DollarSign aria-hidden="true" className="size-3" /> Payment pending
        </li>
        <li className="flex items-center gap-1.5">
          <Lock aria-hidden="true" className="size-3" /> Stop room move
        </li>
      </ul>

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
                <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
                  Room {active.roomNumber}
                  {active.bar.status ? (
                    <Badge className={cn("border-transparent", STATUS_COLOR[active.bar.status])}>
                      {STATUS_LABEL[active.bar.status]}
                    </Badge>
                  ) : null}
                </DialogTitle>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Stay</dt>
                  <dd className="font-medium tabular-nums">{dateSpan(active.bar.checkIn, active.bar.checkOut)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Guest</dt>
                  <dd className="truncate font-medium">{active.bar.guestName}</dd>
                  {active.bar.guestEmail ? (
                    <dd className="truncate text-xs text-muted-foreground">{active.bar.guestEmail}</dd>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Booking ID</dt>
                  <dd className="truncate font-mono text-xs font-medium">{active.bar.bookingId}</dd>
                </div>
                {active.bar.bookingReference ? (
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Reference</dt>
                    <dd className="truncate font-mono text-xs font-medium">{active.bar.bookingReference}</dd>
                  </div>
                ) : null}
                {active.bar.paymentMethod ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Payment</dt>
                    <dd className="font-medium">{active.bar.paymentMethod}</dd>
                  </div>
                ) : null}
                {active.bar.notes ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Notes</dt>
                    <dd>{active.bar.notes}</dd>
                  </div>
                ) : null}
                {active.bar.isGroupBooking || active.bar.paymentPending || active.bar.locked ? (
                  <div className="col-span-2 flex flex-wrap gap-1.5">
                    {active.bar.isGroupBooking ? (
                      <Badge variant="outline">
                        <Users aria-hidden="true" /> Group
                      </Badge>
                    ) : null}
                    {active.bar.paymentPending ? (
                      <Badge variant="warning">
                        <DollarSign aria-hidden="true" /> Payment pending
                      </Badge>
                    ) : null}
                    {active.bar.locked ? (
                      <Badge variant="outline">
                        <Lock aria-hidden="true" /> Stop room move
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </dl>

              {canEdit ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex flex-wrap gap-2">
                    {!active.bar.status || active.bar.status === "confirmed_reserved" || active.bar.status === "check_in" ? (
                      <form action={checkInBooking}>
                        <input type="hidden" name="bookingId" value={active.bar.bookingId} />
                        <SubmitButton pendingText="Checking in…">
                          <LogIn aria-hidden="true" /> Check in
                        </SubmitButton>
                      </form>
                    ) : null}
                    {active.bar.status === "occupied" || active.bar.status === "due_out" ? (
                      <form action={checkOutBooking}>
                        <input type="hidden" name="bookingId" value={active.bar.bookingId} />
                        <SubmitButton variant="outline" pendingText="Checking out…">
                          <LogOut aria-hidden="true" /> Check out
                        </SubmitButton>
                      </form>
                    ) : null}
                    <form action={setBookingRoomLock}>
                      <input type="hidden" name="bookingId" value={active.bar.bookingId} />
                      <input type="hidden" name="locked" value={active.bar.locked ? "false" : "true"} />
                      <SubmitButton variant="ghost" pendingText="Saving…">
                        <Lock aria-hidden="true" /> {active.bar.locked ? "Allow room move" : "Stop room move"}
                      </SubmitButton>
                    </form>
                  </div>
                  <ReallocateForm bookingId={active.bar.bookingId} roomType={active.roomType} currentUnitId={active.bar.roomUnitId} />
                </div>
              ) : null}

              <DialogFooter>
                {canEdit ? (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil aria-hidden="true" /> Edit
                  </Button>
                ) : null}
                <Button variant={canEdit ? "ghost" : "outline"} onClick={() => setActive(null)}>
                  Close
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
  todayDate,
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
  todayDate: string;
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
      <tr>
        <th
          scope="rowgroup"
          className="sticky left-0 z-10 border-t border-border bg-secondary px-4 py-2.5 text-left text-sm font-semibold"
        >
          {roomType.name}
        </th>
        {roomType.dates.map((d) => {
          const sold = d.total > 0 ? Math.min(1, Math.max(0, (d.total - d.available) / d.total)) : 0;
          const bar = d.available === 0 ? "bg-destructive" : sold >= 0.75 ? "bg-brand-gold" : "bg-primary";
          return (
            <td
              key={d.date}
              className={cn(
                "border-t border-l border-border px-3 py-2 text-center",
                d.date === todayDate ? "bg-primary/10" : "bg-secondary/40"
              )}
            >
              <div className="flex items-baseline justify-center gap-1">
                <span
                  className={cn(
                    "font-heading text-sm font-semibold tabular-nums",
                    d.available === 0 && "text-destructive"
                  )}
                >
                  {d.available}
                </span>
                <span className="text-muted-foreground tabular-nums">/ {d.total}</span>
              </div>
              <div
                role="meter"
                aria-label={`${d.date} sold`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(sold * 100)}
                className="mx-auto mt-1 h-1 w-full max-w-16 overflow-hidden rounded-full bg-foreground/10"
              >
                <div className={cn("h-full rounded-full", bar)} style={{ width: `${sold * 100}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                {roomType.currency} {Math.round(d.price).toLocaleString("en-US")}
              </div>
            </td>
          );
        })}
      </tr>
      {visibleUnits.map((unit) => {
        const cells = buildRowCells(dateList, bars[unit.id] ?? [], disabledByUnit.get(unit.id) ?? []);
        return (
          <tr key={unit.id} className="group/unit">
            <th
              scope="row"
              className="sticky left-0 z-10 border-t border-border bg-card px-4 py-1.5 text-left font-medium group-hover/unit:bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))]"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="tabular-nums">
                  {unit.roomNumber}
                  {unit.floor ? <span className="font-normal text-muted-foreground"> · F{unit.floor}</span> : null}
                </span>
                {canEdit ? <DisableRoomButton hotelId={hotelId} roomUnitId={unit.id} roomNumber={unit.roomNumber} /> : null}
              </div>
            </th>
            {cells.map((cell, idx) =>
              cell.type === "empty" ? (
                <td
                  key={idx}
                  className={cn(
                    "border-t border-l border-border group-hover/unit:bg-muted/30",
                    dateList[cell.startIdx] === todayDate && "bg-primary/5",
                    canEdit && "cursor-crosshair"
                  )}
                  onMouseDown={
                    canEdit
                      ? (e) => onBeginDrag("create", unit.id, roomType.id, cell.startIdx, 1, e.clientX)
                      : undefined
                  }
                />
              ) : cell.type === "disabled" ? (
                <td
                  key={idx}
                  colSpan={cell.span}
                  title={cell.reason ?? undefined}
                  className="border-t border-l border-border bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,transparent_6px_12px)] px-2 py-1.5 text-center text-muted-foreground"
                >
                  <span className="inline-flex items-center gap-1 rounded bg-card/80 px-1.5">
                    <Ban aria-hidden="true" className="size-3" /> Out of order
                  </span>
                </td>
              ) : (
                <td key={idx} colSpan={cell.span} className="relative border-t border-l border-border p-0.5">
                  {(() => {
                    const StatusIcon = cell.bar.status ? STATUS_ICON[cell.bar.status] : undefined;
                    const label = `${cell.bar.guestName}, ${cell.bar.status ? STATUS_LABEL[cell.bar.status] : "Booking"}, ${dateSpan(cell.bar.checkIn, cell.bar.checkOut)}`;
                    return (
                      <button
                        type="button"
                        title={label}
                        aria-label={label}
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
                          "flex min-h-7 w-full items-center gap-1 rounded-md px-1.5 py-1 text-left font-medium outline-none transition-[filter] hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50",
                          canEdit && !cell.bar.locked && "cursor-grab active:cursor-grabbing",
                          cell.bar.status ? STATUS_COLOR[cell.bar.status] : "bg-muted text-muted-foreground"
                        )}
                      >
                        {StatusIcon ? <StatusIcon aria-hidden="true" className="size-3 shrink-0" /> : null}
                        <span className="truncate">{cell.bar.guestName}</span>
                        {cell.bar.isGroupBooking ? <Users aria-hidden="true" className="size-3 shrink-0" /> : null}
                        {cell.bar.paymentPending ? <DollarSign aria-hidden="true" className="size-3 shrink-0" /> : null}
                        {cell.bar.locked ? <Lock aria-hidden="true" className="size-3 shrink-0" /> : null}
                      </button>
                    );
                  })()}
                  {canEdit && !cell.bar.locked ? (
                    <>
                      <div
                        aria-hidden="true"
                        className="absolute top-0 left-0.5 h-full w-2 cursor-ew-resize"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onBeginDrag("resize-start", unit.id, roomType.id, cell.startIdx, cell.span, e.clientX, cell.bar.bookingId);
                        }}
                      />
                      <div
                        aria-hidden="true"
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
  const [lastPrefill, setLastPrefill] = useState(prefill);
  if (prefill !== lastPrefill) {
    setLastPrefill(prefill);
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
          <DialogTitle>Book rooms</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="fd-add-checkIn">Check-in</FieldLabel>
              <Input id="fd-add-checkIn" name="checkIn" type="date" min={today} required value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="fd-add-checkOut">Check-out</FieldLabel>
              <Input id="fd-add-checkOut" name="checkOut" type="date" min={checkIn || today} required value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </Field>
          </div>
          <Field>
            <div className="flex items-baseline justify-between gap-2">
              <FieldLabel htmlFor="fd-add-roomType">Room type</FieldLabel>
              {checkIn && availableForCheckIn !== undefined ? (
                <span className={cn("text-xs tabular-nums", availableForCheckIn === 0 ? "text-destructive" : "text-muted-foreground")}>
                  {availableForCheckIn} available
                </span>
              ) : null}
            </div>
            <input type="hidden" name="roomTypeId" value={roomTypeId} />
            <Select value={roomTypeId} onValueChange={(v) => setRoomTypeId(String(v ?? ""))}>
              <SelectTrigger id="fd-add-roomType" className="w-full">
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
          </Field>
          <Field>
            <FieldLabel htmlFor="fd-add-numRooms">Rooms</FieldLabel>
            <Input id="fd-add-numRooms" name="numRooms" type="number" min={1} max={20} defaultValue={1} required className="tabular-nums" />
          </Field>
          <FieldError>{state?.error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Booking…">Book</SubmitButton>
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
      <DialogTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Disable room ${roomNumber}`}
            title="Disable room"
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Ban aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Disable room {roomNumber}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomUnitId" value={roomUnitId} />
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor={`fd-dis-start-${roomUnitId}`}>From</FieldLabel>
              <Input id={`fd-dis-start-${roomUnitId}`} name="dateStart" type="date" min={today} required />
            </Field>
            <Field>
              <FieldLabel htmlFor={`fd-dis-end-${roomUnitId}`}>Back on</FieldLabel>
              <Input id={`fd-dis-end-${roomUnitId}`} name="dateEnd" type="date" min={today} required aria-invalid={Boolean(state?.error)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`fd-dis-reason-${roomUnitId}`}>Reason</FieldLabel>
            <Input id={`fd-dis-reason-${roomUnitId}`} name="reason" placeholder="Maintenance" />
          </Field>
          <FieldError>{state?.error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="destructive" pendingText="Disabling…">
              Disable
            </SubmitButton>
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
      <Field>
        <FieldLabel htmlFor={`fd-realloc-${bookingId}`}>Room</FieldLabel>
        <div className="flex items-center gap-2">
          <Select value={roomUnitId} onValueChange={(v) => setRoomUnitId(String(v ?? currentUnitId))}>
            <SelectTrigger id={`fd-realloc-${bookingId}`} className="min-w-0 flex-1">
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
          <SubmitButton variant="outline" className="shrink-0" pendingText="Moving…" disabled={roomUnitId === currentUnitId}>
            <ArrowLeftRight aria-hidden="true" /> Reallocate
          </SubmitButton>
        </div>
        <FieldError>{state?.error}</FieldError>
      </Field>
    </form>
  );
}

/** Edit modal — dates, price and occupancy; see updateBookingDetails in front-desk-actions.ts. */
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
          <DialogTitle>Edit booking</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bar.bookingId} />

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="fd-edit-checkIn">Check-in</FieldLabel>
              <Input id="fd-edit-checkIn" name="checkIn" type="date" defaultValue={bar.checkIn} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="fd-edit-checkOut">Check-out</FieldLabel>
              <Input id="fd-edit-checkOut" name="checkOut" type="date" defaultValue={bar.checkOut} required />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="fd-edit-totalPrice">Price</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>{currency}</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="fd-edit-totalPrice"
                name="totalPrice"
                type="number"
                min={0}
                step="0.01"
                defaultValue={bar.totalPrice}
                required
                className="tabular-nums"
              />
            </InputGroup>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="fd-edit-numAdults">Adults</FieldLabel>
              <Input id="fd-edit-numAdults" name="numAdults" type="number" min={1} max={30} defaultValue={bar.numAdults} required className="tabular-nums" />
            </Field>
            <Field>
              <FieldLabel htmlFor="fd-edit-numChildren">Children</FieldLabel>
              <Input id="fd-edit-numChildren" name="numChildren" type="number" min={0} max={30} defaultValue={bar.numChildren} required className="tabular-nums" />
            </Field>
          </div>

          <FieldError>{state?.error}</FieldError>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
