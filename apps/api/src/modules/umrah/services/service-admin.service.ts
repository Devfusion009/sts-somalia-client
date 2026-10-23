import { BadRequestException, Injectable } from "@nestjs/common";
import { submittedRequestSchema, type ServiceUpsertInput } from "@sts/shared-types";
import { OrdersService } from "../../orders/orders.service";
import { ServiceCatalogRepository } from "../repositories/service-catalog.repository";
import { CustomRequestRepository } from "../repositories/custom-request.repository";
import { UmrahBookingRepository } from "../repositories/umrah-booking.repository";
import { UmrahNotifyService } from "./umrah-notify.service";

const HOTEL_CATEGORIES = new Set(["hotel_makkah", "hotel_madinah"]);

/** Admin: the private-trip service catalog, and quoting / deciding private requests. */
@Injectable()
export class ServiceAdminService {
  constructor(
    private readonly catalog: ServiceCatalogRepository,
    private readonly requests: CustomRequestRepository,
    private readonly bookings: UmrahBookingRepository,
    private readonly orders: OrdersService,
    private readonly notify: UmrahNotifyService
  ) {}

  listServices() {
    return this.catalog.findAllAdmin();
  }

  async saveService(d: ServiceUpsertInput) {
    const saved = await this.catalog.save(d.serviceId, {
      category: d.category,
      name: d.name,
      description: d.description || null,
      tier: d.tier,
      price: d.price,
      price_unit: d.priceUnit,
      star_rating: d.starRating,
      distance_to_haram_m: d.distanceToHaram,
      is_default: d.isDefault,
      sort_order: d.sortOrder,
      status: d.status,
    });
    if (saved === "duplicate_default") {
      throw new BadRequestException(
        "Another published option in this category is already the default for that standard. Clear its default first."
      );
    }
    // Only hotels are priced by occupancy; any other category clears them.
    const isHotel = HOTEL_CATEGORIES.has(d.category);
    await this.catalog.saveSharingPrices(
      saved,
      [1, 2, 3, 4].map((sharing) => ({
        sharing,
        price: isHotel ? (d.sharingPrices.find((p) => p.sharing === sharing)?.price ?? null) : null,
      }))
    );
  }

  deleteService(serviceId: string) {
    return this.catalog.delete(serviceId);
  }

  async submittedRequests() {
    return submittedRequestSchema.array().parse(await this.requests.findSubmitted());
  }

  /** Quote a private request while unpaid; an agency order keeps its margin on top. */
  async quote(bookingId: string, price: number) {
    const item = await this.bookings.findOrderItem(bookingId);
    if (item?.order && item.order.status !== "pending_payment") throw new BadRequestException("This order already has a payment.");
    await this.bookings.updateTotalPrice(bookingId, price);
    if (item?.order) await this.orders.repriceQuotedOrder(item.order, item.id, "umrah", price);
    this.notify.send(bookingId, "request_quoted");
  }

  /** Confirm through the stage machine, or decline (unpaid order cancelled, paid left to refunds). */
  async decide(bookingId: string, status: "confirmed" | "cancelled", note?: string) {
    const error =
      status === "confirmed" ? await this.bookings.setStage(bookingId, "confirmed") : await this.bookings.declinePrivate(bookingId, note);
    if (error) throw new BadRequestException(status === "confirmed" ? "The request could not be confirmed." : "The request could not be declined.");
    this.notify.send(bookingId, status === "confirmed" ? "stage_changed" : "request_declined", note || undefined);
  }
}
