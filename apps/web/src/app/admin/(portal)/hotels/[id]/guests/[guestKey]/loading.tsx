import { HotelDetailLoading } from "../../section-detail-loading";

export default function HotelGuestLoading() {
  return <HotelDetailLoading label="guest" rail={["Stays", "Room nights", "Spent", "Cancelled", "No-shows", "Next arrival"]} />;
}
