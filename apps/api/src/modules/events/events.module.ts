import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";
import { VenuePartnerService } from "./venue-partner.service";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [OrdersModule],
  providers: [EventsService, VenuePartnerService],
  exports: [EventsService, VenuePartnerService],
})
export class EventsModule {}
