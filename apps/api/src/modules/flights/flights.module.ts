import { Module } from "@nestjs/common";
import { FlightsService } from "./flights.service";
import { FlightTicketingService } from "./flight-ticketing.service";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [OrdersModule],
  providers: [FlightsService, FlightTicketingService],
  exports: [FlightsService, FlightTicketingService],
})
export class FlightsModule {}
