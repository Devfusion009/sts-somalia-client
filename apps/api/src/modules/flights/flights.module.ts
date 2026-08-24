import { Module } from "@nestjs/common";
import { FlightsService } from "./flights.service";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [OrdersModule],
  providers: [FlightsService],
  exports: [FlightsService],
})
export class FlightsModule {}
