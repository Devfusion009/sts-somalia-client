export type UmrahPoolRow = {
  package_id: string; name: string; package_status: string; pool_visibility: string; organizer_name: string;
  contact_person_name: string | null; contact_person_phone: string | null; contact_person_email: string | null;
  departure_id: string | null; departure_date: string | null; return_date: string | null;
  sales_close_days?: number; departure_status: string | null; total_seats: number | null; booked_seats: number | null;
  offline_seats: number | null; available_seats: number; confirmed_seats: number; held_seats: number;
  bookings: number; customers: number;
};

export function poolCapacity(row: Pick<UmrahPoolRow, "total_seats" | "confirmed_seats" | "held_seats" | "offline_seats">) {
  const total = Number(row.total_seats ?? 0);
  const filled = Number(row.confirmed_seats) + Number(row.offline_seats ?? 0);
  const held = Number(row.held_seats);
  return { total, filled, held, remaining: Math.max(0, total - filled - held), percent: total > 0 ? Math.min(100, filled / total * 100) : 0 };
}

export function poolStatus(row: Pick<UmrahPoolRow, "package_status" | "departure_status" | "departure_date" | "pool_visibility" | "total_seats" | "confirmed_seats" | "held_seats" | "offline_seats"> & { sales_close_days?: number }, today = new Date().toISOString().slice(0,10)) {
  if (row.package_status !== "published") return row.package_status === "draft" ? "Draft" : row.package_status.replace(/_/g," ");
  if (!row.departure_date) return "No dates";
  const close = new Date(`${row.departure_date}T00:00:00Z`);
  close.setUTCDate(close.getUTCDate() - (row.sales_close_days ?? 0));
  if (row.departure_status !== "open" || close.toISOString().slice(0,10) <= today) return "Closed";
  if (poolCapacity(row).remaining === 0) return "Full";
  return row.pool_visibility === "private" ? "Private" : "Open";
}
