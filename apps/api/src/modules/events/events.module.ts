import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { EventsService } from "./events.service";
import { VenuePartnerService } from "./venue-partner.service";
import { VenueRepository } from "./repositories/venue.repository";
import { HallBookingRepository } from "./repositories/hall-booking.repository";
import { VenuePartnerRepository } from "./repositories/venue-partner.repository";

/**
 * Events & halls. Repositories are internal (not exported): other modules
 * reach this domain through EventsService only — see index.ts.
 */
@Module({
  imports: [OrdersModule],
  providers: [EventsService, VenuePartnerService, VenueRepository, HallBookingRepository, VenuePartnerRepository],
  exports: [EventsService],
})
export class EventsModule {}
