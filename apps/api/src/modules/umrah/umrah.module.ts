import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { UmrahController } from "./umrah.controller";
import { PackageRepository } from "./repositories/package.repository";
import { ServiceCatalogRepository } from "./repositories/service-catalog.repository";
import { CustomRequestRepository } from "./repositories/custom-request.repository";
import { UmrahBookingRepository } from "./repositories/umrah-booking.repository";
import { UmrahSettingsRepository } from "./repositories/umrah-settings.repository";
import { UmrahNotifyService } from "./services/umrah-notify.service";
import { UmrahCatalogService } from "./services/umrah-catalog.service";
import { GroupBookingService } from "./services/group-booking.service";
import { PrivateTripService } from "./services/private-trip.service";
import { PilgrimService } from "./services/pilgrim.service";
import { PackageAdminService } from "./services/package-admin.service";
import { ServiceAdminService } from "./services/service-admin.service";
import { DepartureAdminService } from "./services/departure-admin.service";
import { FulfillmentAdminService } from "./services/fulfillment-admin.service";

/** Umrah: group packages, private trips, pilgrims and operations. Only UmrahCatalogService is public. */
@Module({
  imports: [OrdersModule],
  controllers: [UmrahController],
  providers: [
    PackageRepository,
    ServiceCatalogRepository,
    CustomRequestRepository,
    UmrahBookingRepository,
    UmrahSettingsRepository,
    UmrahNotifyService,
    UmrahCatalogService,
    GroupBookingService,
    PrivateTripService,
    PilgrimService,
    PackageAdminService,
    ServiceAdminService,
    DepartureAdminService,
    FulfillmentAdminService,
  ],
  exports: [UmrahCatalogService],
})
export class UmrahModule {}
