/**
 * Re-export, not a definition. Moved to packages/shared-types (phase 4b)
 * so apps/api's bookings module could return/validate the same shape.
 * Kept under this path so existing component imports need no changes.
 */
export type { BookingType, BookingTimeframe, UnifiedBooking, Trip } from "@sts/shared-types";
export { bookingTimeframe, groupIntoTrips } from "@sts/shared-types";
