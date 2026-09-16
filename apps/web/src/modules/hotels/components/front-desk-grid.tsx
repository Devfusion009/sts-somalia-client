"use client";

import { useActionState, useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Search, Users, DollarSign, Lock, LogIn, LogOut, Pencil, ArrowLeftRight, X } from "lucide-react";
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
  | { type: "empty"; span: 1 }
  | { type: "disabled"; span: number; reason: string | null }
  | { type: "bar"; span: number; bar: FrontDeskBar };

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
      cells.push({ type: "empty", span: 1 });
      i++;
    }
    const span = endIdx - startIdx;
    if (range.kind === "bar") cells.push({ type: "bar", span, bar: range.bar! });
    else cells.push({ type: "disabled", span, reason: range.reason ?? null });
    i = endIdx;
  }
  while (i < dateList.length) {
    cells.push({ type: "empty", span: 1 });
    i++;
  }
  return cells;
}

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

  const disabledByUnit = useMemo(() => {
    const map = new Map<string, FrontDeskDisabledRange[]>();
    for (const d of disabledRanges) {
      if (!map.has(d.roomUnitId)) map.set(d.roomUnitId, []);
      map.get(d.roomUnitId)!.push(d);
    }
    return map;
  }, [disabledRanges]);

  const needle = search.trim().toLowerCase();

  function unitMatchesFilters(unitBars: FrontDeskBar[]) {
    if (!needle && roomTypeFilter.size === 0 && statusFilter.size === 0) return true;
    return unitBars.some((b) => {
      const matchesSearch = !needle || b.guestName.toLowerCase().includes(needle) || b.bookingId.toLowerCase().includes(needle);
      const matchesStatus = statusFilter.size === 0 || (b.status && statusFilter.has(b.status));
      return matchesSearch && matchesStatus;
    });
  }

  const visibleRoomTypes = roomTypes.filter((rt) => roomTypeFilter.size === 0 || roomTypeFilter.has(rt.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Booking ID, guest name…"
            className="h-8 pl-8 text-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" className="h-8" />}>
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
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" className="h-8" />}>
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
          <div className="ml-auto">
            <AddBookingButton hotelId={hotelId} roomTypes={roomTypes} />
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-28 border-b border-border bg-card px-3 py-2 text-left font-semibold">
                Room Num
              </th>
              {dateList.map((date) => (
                <th key={date} className="min-w-28 border-b border-l border-border bg-card px-2 py-2 text-center font-semibold">
                  <div>{format(new Date(`${date}T00:00:00Z`), "EEE")}</div>
                  <div className="text-muted-foreground">{format(new Date(`${date}T00:00:00Z`), "dd MMM")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRoomTypes.map((rt) => (
              <RoomTypeSection
                key={rt.id}
                roomType={rt}
                dateList={dateList}
                bars={bars}
                disabledByUnit={disabledByUnit}
                unitMatchesFilters={unitMatchesFilters}
                onSelectBar={(roomNumber, bar) => setActive({ roomNumber, bar, roomType: rt })}
              />
            ))}
            {visibleRoomTypes.every((rt) => rt.units.length === 0) ? (
              <tr>
                <td colSpan={dateList.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                  No rooms added yet — add rooms under each room type first.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

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
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Booking ID</dt>
                  <dd className="font-mono text-xs font-semibold">{active.bar.bookingId}</dd>
                </div>
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
  roomType,
  dateList,
  bars,
  disabledByUnit,
  unitMatchesFilters,
  onSelectBar,
}: {
  roomType: FrontDeskRoomType;
  dateList: string[];
  bars: Record<string, FrontDeskBar[]>;
  disabledByUnit: Map<string, FrontDeskDisabledRange[]>;
  unitMatchesFilters: (unitBars: FrontDeskBar[]) => boolean;
  onSelectBar: (roomNumber: string, bar: FrontDeskBar) => void;
}) {
  const visibleUnits = roomType.units.filter((u) => unitMatchesFilters(bars[u.id] ?? []));

  return (
    <>
      <tr className="bg-secondary/40">
        <th className="sticky left-0 z-10 bg-secondary/60 px-3 py-1.5 text-left font-semibold">{roomType.name}</th>
        {roomType.dates.map((d) => (
          <td key={d.date} className="border-l border-border bg-secondary/40 px-2 py-1.5 text-center">
            <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">
              {d.available}/{d.total}
            </span>
            <div className="mt-0.5 text-muted-foreground">{roomType.currency} {d.price.toFixed(0)}</div>
          </td>
        ))}
      </tr>
      {visibleUnits.map((unit) => {
        const cells = buildRowCells(dateList, bars[unit.id] ?? [], disabledByUnit.get(unit.id) ?? []);
        return (
          <tr key={unit.id}>
            <td className="sticky left-0 z-10 border-t border-border bg-card px-3 py-1.5 font-medium">
              {unit.roomNumber}
              {unit.floor ? <span className="text-muted-foreground"> · F{unit.floor}</span> : null}
            </td>
            {cells.map((cell, idx) =>
              cell.type === "empty" ? (
                <td key={idx} className="border-t border-l border-border" />
              ) : cell.type === "disabled" ? (
                <td key={idx} colSpan={cell.span} className="border-t border-l border-border bg-muted px-2 py-1.5 text-center text-muted-foreground">
                  Out of order
                </td>
              ) : (
                <td key={idx} colSpan={cell.span} className="border-t border-l border-border p-0.5">
                  <button
                    type="button"
                    onClick={() => onSelectBar(unit.roomNumber, cell.bar)}
                    className={cn(
                      "flex w-full items-center gap-1 rounded px-1.5 py-1 text-left font-medium",
                      cell.bar.status ? STATUS_COLOR[cell.bar.status] : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="truncate">{cell.bar.guestName}</span>
                    {cell.bar.isGroupBooking ? <Users className="size-3 shrink-0" /> : null}
                    {cell.bar.paymentPending ? <DollarSign className="size-3 shrink-0" /> : null}
                    {cell.bar.locked ? <Lock className="size-3 shrink-0" /> : null}
                  </button>
                </td>
              )
            )}
          </tr>
        );
      })}
    </>
  );
}

/** "Add Booking" — room type + quantity only; reserves capacity via the same allocator every other booking path uses. */
function AddBookingButton({ hotelId, roomTypes }: { hotelId: string; roomTypes: FrontDeskRoomType[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FrontDeskActionState, FormData>(createFrontDeskBooking, null);
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const selectedRoomType = roomTypes.find((rt) => rt.id === roomTypeId);
  const availableForCheckIn = selectedRoomType?.dates.find((d) => d.date === checkIn)?.available;

  // Derived during render (not an effect), same pattern as the other
  // dialog-closes-on-success forms in this codebase — refs can't be
  // read/written during render.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="size-4" /> Add Booking
      </DialogTrigger>
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
              <Input id="checkOut" name="checkOut" type="date" min={checkIn || today} required />
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <SubmitButton pendingText="Booking…">Book Rooms</SubmitButton>
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
              <Label>Check-In</Label>
              <Input value={bar.checkIn} disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>Check-Out</Label>
              <Input value={bar.checkOut} disabled className="bg-muted text-muted-foreground" />
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
