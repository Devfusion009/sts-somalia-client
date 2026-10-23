// Contract tests for the Umrah domain: pricing, sales cutoff, lead time, itinerary, DTO stripping.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookableDepartures,
  buildDatedItinerary,
  createGroupBookingSchema,
  packageCardSchema,
  priceSelection,
  privateDepartureLeadError,
  stageErrorMessage,
  tripReturnDate,
  umrahVoucherAvailable,
} from "../dist/index.js";

const hotel = { id: "h1", category: "hotel_makkah", name: "H", description: null, tier: null, price: 50, currency: "USD", price_unit: "per_person_per_night", star_rating: null, distance_to_haram_m: null, is_default: false, sort_order: 0 };
const visa = { ...hotel, id: "v1", category: "visa", price: 120, price_unit: "per_person" };

test("hotel priced per person per Makkah night, visa per person", () => {
  const { lines, total } = priceSelection([hotel, visa], { numPilgrims: 2, nightsMakkah: 5, nightsMadinah: 3 });
  assert.equal(lines.find((l) => l.serviceId === "h1").lineTotal, 500);
  assert.equal(total, 740);
});

test("room sharing price overrides the hotel base price", () => {
  const { total } = priceSelection([hotel], { numPilgrims: 2, nightsMakkah: 5, nightsMadinah: 0 }, { roomSharing: 2, sharingPrices: { h1: { 2: 80 } } });
  assert.equal(total, 800);
});

test("a city with zero nights drops its hotel line", () => {
  const { lines } = priceSelection([hotel], { numPilgrims: 2, nightsMakkah: 0, nightsMadinah: 4 });
  assert.equal(lines.length, 0);
});

test("return date counts nights from the departure day", () => {
  assert.equal(tripReturnDate("2026-11-10", { numPilgrims: 1, nightsMakkah: 5, nightsMadinah: 3 }), "2026-11-18");
});

test("departures stop selling at their sales cutoff", () => {
  const deps = [
    { departure_date: "2026-11-20", sales_close_days: 10, status: "open" },
    { departure_date: "2026-11-05", sales_close_days: 0, status: "open" },
    { departure_date: "2026-12-01", sales_close_days: 0, status: "closed" },
  ];
  assert.deepEqual(bookableDepartures(deps, "2026-11-04").map((d) => d.departure_date), ["2026-11-05", "2026-11-20"]);
  assert.deepEqual(bookableDepartures(deps, "2026-11-10").map((d) => d.departure_date), []);
});

test("private trips respect the lead time", () => {
  assert.equal(privateDepartureLeadError("2026-11-05", 0, "2026-11-04"), null);
  assert.match(privateDepartureLeadError("2026-11-05", 3, "2026-11-04"), /at least 4 days/);
});

test("itinerary dates hotel stays from the departure", () => {
  const it = buildDatedItinerary({
    departureDate: "2026-11-10",
    returnDate: "2026-11-18",
    hotels: [{ city: "makkah", name: "A", nights: 5, sort_order: 0 }, { city: "madinah", name: "B", nights: 3, sort_order: 1 }],
  });
  assert.equal(it.stays[1].checkIn, "2026-11-15");
  assert.equal(it.entries.length, 9);
  assert.deepEqual(it.warnings, []);
});

test("voucher unlocks only when paid and travel is confirmed", () => {
  assert.equal(umrahVoucherAvailable("partially_paid", "travel_confirmed"), false);
  assert.equal(umrahVoucherAvailable("paid", "confirmed"), false);
  assert.equal(umrahVoucherAvailable("paid", "documents_ready"), true);
});

test("stage RPC text maps to one plain line", () => {
  assert.equal(stageErrorMessage("booking has not been paid"), "This booking has not been paid yet.");
});

test("group booking DTO requires a departure and pilgrims", () => {
  assert.equal(createGroupBookingSchema.safeParse({ departureId: "x", numPilgrims: 1, pilgrims: [] }).success, false);
});

test("package card DTO drops unknown columns", () => {
  const card = packageCardSchema.parse({
    id: "p", slug: "s", name: "N", tagline: null, tier: null, isFeatured: false, originIata: null, destinationIata: null,
    duration_days: 10, base_price: "1200.00", originalPrice: null, currency: "USD", includes: [], images: [], hotels: [],
    nextDeparture: null, contact_person_phone: "private",
  });
  assert.equal("contact_person_phone" in card, false);
  assert.equal(card.base_price, 1200);
});
