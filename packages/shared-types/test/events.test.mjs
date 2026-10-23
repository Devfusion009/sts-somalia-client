// Contract tests for the events domain: the rules apps/web and apps/api both
// rely on. Runs on Node's built-in runner against the compiled package.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeHallPrice,
  hallAwaitingQuote,
  nextHallBookingMoves,
  publicVenueSchema,
  venueCapacity,
} from "../dist/index.js";

const base = { expectedGuests: 50, startDate: "2026-12-10", endDate: "2026-12-11" };

test("per_day counts both end dates", () => {
  const p = computeHallPrice({ ...base, basePrice: 400.5, priceUnit: "per_day" });
  assert.equal(p.quantity, 2);
  assert.equal(p.total, 801);
});

test("per_person multiplies by guests", () => {
  assert.equal(computeHallPrice({ ...base, basePrice: 12.75, priceUnit: "per_person" }).total, 637.5);
});

test("per_hour without times is not a final price", () => {
  const p = computeHallPrice({ ...base, basePrice: 100, priceUnit: "per_hour" });
  assert.equal(p.needsTimes, true);
});

test("per_hour overnight wraps past midnight", () => {
  const p = computeHallPrice({ ...base, endDate: base.startDate, basePrice: 100, priceUnit: "per_hour", startTime: "22:00", endTime: "02:00" });
  assert.equal(p.quantity, 4);
});

test("zero base price is on request", () => {
  assert.equal(computeHallPrice({ ...base, basePrice: 0, priceUnit: "per_event" }).onRequest, true);
});

test("capacity is the larger of seated and standing", () => {
  assert.equal(venueCapacity({ capacity_seated: 80, capacity_standing: 120 }), 120);
  assert.equal(venueCapacity({ capacity_seated: null, capacity_standing: null }), null);
});

test("a request can be confirmed or declined until its date passes", () => {
  const b = { status: "pending", start_date: "2026-12-10", end_date: "2026-12-10", price: 100 };
  assert.deepEqual(nextHallBookingMoves(b, "2026-11-01"), ["confirmed", "cancelled"]);
  assert.deepEqual(nextHallBookingMoves(b, "2026-12-11"), ["cancelled"]);
});

test("only admin may mark a cancelled booking refunded", () => {
  const b = { status: "cancelled", start_date: "2026-12-10", end_date: "2026-12-10", price: 100 };
  assert.deepEqual(nextHallBookingMoves(b, "2026-11-01"), []);
  assert.deepEqual(nextHallBookingMoves(b, "2026-11-01", true), ["refunded"]);
});

test("request-first halls can't be paid before the venue quotes", () => {
  const venue = { price_unit: "per_person", base_price: 12.75 };
  assert.equal(hallAwaitingQuote({ status: "pending", venue }), true);
  assert.equal(hallAwaitingQuote({ status: "confirmed", venue }), false);
  assert.equal(hallAwaitingQuote({ status: "pending", venue: { price_unit: "per_day", base_price: 400 } }), false);
});

test("public venue DTO drops private columns", () => {
  const v = publicVenueSchema.parse({
    id: "v1", slug: "s", name: "N", tagline: null, description: null, city: "C", address: null, phone: null,
    capacity_seated: null, capacity_standing: 10, size_sqm: null, base_price: "5", currency: "USD",
    price_unit: "per_event", event_types: ["wedding", 3], amenities: null, images: ["a.jpg"], is_featured: true,
    policies: null, partner_id: "private", contact_email: "private@example.com", status: "published",
  });
  assert.equal("partner_id" in v, false);
  assert.equal("contact_email" in v, false);
  assert.equal(v.base_price, 5);
  assert.deepEqual(v.event_types, ["wedding"]);
});
