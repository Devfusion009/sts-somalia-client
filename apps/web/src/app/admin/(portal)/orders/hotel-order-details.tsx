import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { AdminOrder } from "@/modules/admin/queries";
import { money } from "@/lib/money";
import { readExtrasSnapshot, readRatePlanSnapshot, readStayDetails, ROOM_PREFERENCES, BOARD_LABEL } from "@/modules/hotels/booking-options";

export function HotelOrderDisclosure({ order, children, opened = false }: { order: AdminOrder; children: ReactNode; opened?: boolean }) {
  if (!order.order_items.some(item => item.hotel_booking)) return <>{children}</>;
  return <details open={opened} className="group/hotel">
    <summary className="flex cursor-pointer list-none items-center gap-4 p-5 outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-6">
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center group-open/hotel:hidden">
        <span className="break-words text-sm font-semibold">{order.agency_customer?.full_name ?? order.customer?.full_name ?? "Customer"}</span>
        <span className="break-all text-sm text-muted-foreground">{order.customer?.email ?? "Email not provided"}</span>
        <span className="text-sm font-semibold tabular-nums">{money(order.total, order.currency)}</span>
      </div>
      <span className="hidden flex-1 text-sm font-medium group-open/hotel:block">Booking details</span>
      <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-primary"><span className="group-open/hotel:hidden">Details</span><span className="hidden group-open/hotel:inline">Close</span><ChevronDown className="size-4 group-open/hotel:rotate-180" aria-hidden="true" /></span>
    </summary>
    <div className="border-t border-border">{children}</div>
  </details>;
}

export function HotelBookingDetails({ order }: { order: AdminOrder }) {
  return <>{order.order_items.map(item => {
    const booking = item.hotel_booking;
    if (!booking) return null;
    const stay = readStayDetails(booking.stay_details);
    const plan = readRatePlanSnapshot(booking.rate_plan);
    const extras = readExtrasSnapshot(booking.extras);
    const guests = Array.isArray(booking.guest_details) ? booking.guest_details.flatMap(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      return typeof value.full_name === "string" ? [{ name: value.full_name, phone: typeof value.phone === "string" ? value.phone : null }] : [];
    }) : [];
    const occupancy = Array.isArray(booking.room_occupancy) ? booking.room_occupancy.flatMap(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      return typeof value.adults === "number" && typeof value.children === "number" ? [{ adults: value.adults, children: value.children }] : [];
    }) : [];
    const facts = [
      ["Hotel", booking.hotel?.name], ["Room type", booking.room?.name],
      ["Check-in", booking.check_in], ["Check-out", booking.check_out],
      ["Rooms", String(booking.num_rooms)], ["Guests", `${booking.num_adults} adults · ${booking.num_children ?? 0} children`],
      ["Booking total", money(booking.total_price, booking.currency)],
      ["Arrival time", stay.arrival_time], ["Trip purpose", stay.purpose],
      ["Booked for someone else", stay.booked_for_other ? "Yes" : null],
      ["Staying guest", stay.lead_guest ? [stay.lead_guest.name, stay.lead_guest.phone].filter(Boolean).join(" · ") : null],
      ["Rate plan", plan?.name], ["Meal plan", plan ? BOARD_LABEL[plan.board] : null],
      ["Cancellation", plan ? plan.cancellation === "non_refundable" ? "Non-refundable" : `Free cancellation${plan.freeCancelDays !== null ? ` until ${plan.freeCancelDays} days before arrival` : ""}` : null],
    ];
    return <section key={item.id} aria-label={`${booking.hotel?.name ?? "Hotel"} booking details`} className="space-y-4">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{facts.filter(([,value]) => value).map(([label,value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium capitalize">{value}</dd></div>)}</dl>
      {occupancy.length ? <div><h3 className="font-semibold">Guests per room</h3><ul className="mt-2 space-y-1">{occupancy.map((room,index) => <li key={index}>Room {index + 1}: {room.adults} adults · {room.children} children</li>)}</ul></div> : null}
      {guests.length ? <div><h3 className="font-semibold">Guest names</h3><ul className="mt-2 space-y-1">{guests.map((guest,index) => <li key={index}>{guest.name}{guest.phone ? ` · ${guest.phone}` : ""}</li>)}</ul></div> : null}
      {stay.preferences?.some(pref => Object.keys(pref).length) ? <div><h3 className="font-semibold">Room preferences</h3><ul className="mt-2 space-y-2">{stay.preferences.map((pref,index) => Object.keys(pref).length ? <li key={index}><span className="font-medium">Room {index + 1}</span><ul className="mt-1 space-y-1 text-muted-foreground">{Object.entries(pref).map(([key,value]) => <li key={key}>{ROOM_PREFERENCES[key as keyof typeof ROOM_PREFERENCES].label}: {value}</li>)}</ul></li> : null)}</ul></div> : null}
      {extras.length ? <div><h3 className="font-semibold">Extras</h3><ul className="mt-2 space-y-1">{extras.map(extra => <li key={extra.id}>{extra.name} × {extra.quantity} · {money(extra.total, booking.currency)}</li>)}</ul></div> : null}
      {booking.special_requests ? <div><h3 className="font-semibold">Special requests</h3><p className="mt-2 whitespace-pre-wrap break-words">{booking.special_requests}</p></div> : null}
    </section>;
  })}</>;
}
