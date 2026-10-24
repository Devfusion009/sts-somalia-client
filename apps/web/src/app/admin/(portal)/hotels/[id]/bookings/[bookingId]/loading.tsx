import { HotelDetailLoading } from "../../section-detail-loading";

export default function HotelBookingLoading() {
  return <HotelDetailLoading label="booking" rail={["Check-in", "Check-out", "Nights", "Rooms", "Guests", "Total"]} />;
}
