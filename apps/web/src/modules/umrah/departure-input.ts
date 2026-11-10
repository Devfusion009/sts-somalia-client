/** Shared form conversion for admin departure mutations. Validation stays in the API. */
export function departureInput(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const orNull = (key: string) => text(key) || null;
  return {
    departureId: text("departureId") || undefined,
    packageId: text("packageId"),
    departureDate: text("departureDate"),
    returnDate: text("returnDate"),
    totalSeats: Number(text("totalSeats")),
    offlineSeats: Number(text("offlineSeats") || 0),
    priceOverride: text("priceOverride") === "" ? null : Number(text("priceOverride")),
    outboundAirline: orNull("outboundAirline"),
    outboundFlightNumber: orNull("outboundFlightNumber"),
    outboundDepartsAt: orNull("outboundDepartsAt"),
    outboundArrivesAt: orNull("outboundArrivesAt"),
    returnAirline: orNull("returnAirline"),
    returnFlightNumber: orNull("returnFlightNumber"),
    returnDepartsAt: orNull("returnDepartsAt"),
    returnArrivesAt: orNull("returnArrivesAt"),
    baggageNote: orNull("baggageNote"),
    salesCloseDays: Number(text("salesCloseDays") || 0),
    // A cancelled departure posts no status (the field is disabled) and stays cancelled.
    status: (text("status") || null) as "open" | "closed" | null,
  };
}

