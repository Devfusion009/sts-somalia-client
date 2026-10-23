import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  stageErrorMessage,
  UMRAH_STAFF_DOC_TYPES,
  type Database,
  type PilgrimReadiness,
  type SegmentUpsertInput,
  type UmrahBookingsFilter,
} from "@sts/shared-types";
import { UmrahBookingRepository, ADMIN_PAGE_SIZE, type UmrahStage } from "../repositories/umrah-booking.repository";
import { CustomRequestRepository } from "../repositories/custom-request.repository";
import { UmrahCatalogService } from "./umrah-catalog.service";
import { UmrahNotifyService } from "./umrah-notify.service";
import { assertDocumentFile, safeFileName, type UploadedFile } from "./pilgrim.service";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const PAYMENT_STATUSES: Record<NonNullable<UmrahBookingsFilter["payment"]>, OrderStatus[]> = {
  unpaid: ["pending_payment", "held"],
  partial: ["partially_paid"],
  paid: ["paid", "processing", "completed"],
  closed: ["cancelled", "refunded"],
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/** Latest order linked through order_items — the one the stage RPC checks for payment. */
function latestOrder<T extends { created_at: string }>(items: { order: T | T[] | null }[] | null | undefined): T | null {
  const orders = (items ?? []).map((i) => one(i.order)).filter((o): o is T => !!o);
  orders.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return orders[0] ?? null;
}

/** Admin: one booking's fulfillment — stage, documents, travel segments, cancellation. */
@Injectable()
export class FulfillmentAdminService {
  constructor(
    private readonly bookings: UmrahBookingRepository,
    private readonly requests: CustomRequestRepository,
    private readonly catalog: UmrahCatalogService,
    private readonly notify: UmrahNotifyService
  ) {}

  async list(filters: UmrahBookingsFilter) {
    const { rows, total } = await this.bookings.list({
      stage: filters.stage,
      departureId: filters.departureId,
      packageId: filters.packageId,
      paymentStatuses: filters.payment ? PAYMENT_STATUSES[filters.payment] : undefined,
      page: filters.page,
    });
    const bookings = rows.map((b) => {
      const order = latestOrder(b.order_items);
      return {
        ...b,
        total_price: Number(b.total_price),
        customer: one(b.customer),
        agency: one(b.agency),
        package: one(b.package),
        departure: one(b.departure),
        custom_request: one(b.custom_request),
        order,
        guest: one(order?.agency_customer),
      };
    });
    return { bookings, total, pageSize: ADMIN_PAGE_SIZE };
  }

  async filterOptions() {
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { packages, departures } = await this.bookings.filterOptions(since);
    return { packages, departures: departures.map((d) => ({ ...d, package: one(d.package) })) };
  }

  async detail(id: string) {
    const data = await this.bookings.detail(id);
    if (!data) return null;
    const documents = [...(data.umrah_booking_documents ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const [signed, readinessRows, travel, serviceLines] = await Promise.all([
      Promise.all(documents.map(async (doc) => ({ ...doc, url: await this.bookings.signDocument(doc.storage_path) }))),
      this.bookings.readiness(id),
      this.catalog.bookingTravel(id),
      data.custom_request_id ? this.requests.findLinesForAdmin(data.custom_request_id) : Promise.resolve([]),
    ]);
    const order = latestOrder(data.order_items);
    const paid = (order?.payments ?? [])
      .filter((p) => p.status === "succeeded")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const readiness: Record<string, PilgrimReadiness> = Object.fromEntries(
      readinessRows.map((r) => [r.pilgrim_id, { missing: r.missing, warnings: r.warnings }])
    );
    return {
      ...data,
      total_price: Number(data.total_price),
      customer: one(data.customer),
      booker: one(data.booker),
      agency: one(data.agency),
      package: one(data.package),
      departure: one(data.departure),
      custom_request: one(data.custom_request),
      order: order
        ? { ...order, total: Number(order.total), paid, balance: Math.max(Number(order.total) - paid, 0), guest: one(order.agency_customer) }
        : null,
      pilgrims: [...(data.umrah_pilgrims ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name)),
      readiness,
      history: [...(data.umrah_booking_stage_history ?? [])]
        .map((h) => ({ ...h, actor: one(h.actor) }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      documents: signed.filter((d) => d.source !== "customer"),
      handedIn: signed.filter((d) => d.source === "customer"),
      travel,
      serviceLines,
    };
  }

  async advanceStage(bookingId: string, stage: UmrahStage, note?: string) {
    const error = await this.bookings.setStage(bookingId, stage, note);
    if (error) throw new BadRequestException(stageErrorMessage(error.message));
    this.notify.send(bookingId, "stage_changed", undefined, stage);
  }

  async uploadStaffDocument(
    adminId: string,
    body: { bookingId: string; docType: string; title: string; pilgrimId?: string },
    file: UploadedFile | undefined
  ) {
    if (!(UMRAH_STAFF_DOC_TYPES as readonly string[]).includes(body.docType)) throw new BadRequestException("Choose a document type.");
    const title = (body.title ?? "").trim();
    if (!title) throw new BadRequestException("Enter a title.");
    if (title.length > 120) throw new BadRequestException("Title must be 120 characters or fewer.");
    const checked = assertDocumentFile(file);
    if (body.pilgrimId && !(await this.bookings.findPilgrimOnBooking(body.pilgrimId, body.bookingId))) {
      throw new NotFoundException("Pilgrim not found on this booking.");
    }
    const path = `${body.bookingId}/${body.docType}-${Date.now()}-${safeFileName(checked.originalname)}`;
    if (await this.bookings.uploadDocument(path, checked.buffer, checked.mimetype)) {
      throw new BadRequestException("The file could not be uploaded.");
    }
    const error = await this.bookings.insertDocument({
      booking_id: body.bookingId,
      pilgrim_id: body.pilgrimId || null,
      doc_type: body.docType,
      title,
      storage_path: path,
      file_name: checked.originalname,
      file_size: checked.size,
      content_type: checked.mimetype,
      uploaded_by: adminId,
    });
    if (error) {
      await this.bookings.removeStorage([path]);
      throw new BadRequestException("The document could not be saved.");
    }
  }

  async deleteDocument(documentId: string) {
    const doc = await this.bookings.findDocument(documentId);
    if (!doc) throw new NotFoundException("Document not found.");
    if (await this.bookings.removeStorage([doc.storage_path])) throw new BadRequestException("The file could not be removed.");
    await this.bookings.deleteDocumentRow(doc.id);
    return { bookingId: doc.booking_id };
  }

  /** Unpaid: the order is cancelled. Paid: an approved cancellation for the amount entered goes to refunds. */
  async cancel(bookingId: string, reason: string, refundAmount?: number) {
    const error = await this.bookings.adminCancel(bookingId, reason, refundAmount);
    if (error) throw new BadRequestException(error.code === "P0001" ? error.message : "The booking could not be cancelled.");
    this.notify.send(bookingId, "booking_cancelled", reason);
  }

  async reviewDocument(documentId: string, decision: "accepted" | "rejected", note?: string) {
    const doc = await this.bookings.findDocument(documentId);
    if (!doc) throw new NotFoundException("Document not found.");
    const error = await this.bookings.reviewDocument(documentId, decision, note);
    if (error) throw new BadRequestException(error.code === "P0001" ? error.message : "The review could not be saved.");
    if (decision === "rejected") this.notify.send(doc.booking_id, "document_rejected", note);
    return { bookingId: doc.booking_id };
  }

  /** Times are wall clock, stored UTC-tagged like departures. */
  async saveSegment(adminId: string, d: SegmentUpsertInput) {
    const row = {
      booking_id: d.bookingId,
      kind: d.kind,
      title: d.title,
      provider: d.provider || null,
      reference: d.reference || null,
      city: d.city,
      starts_at: d.startsAt ? `${d.startsAt}:00Z` : null,
      ends_at: d.endsAt ? `${d.endsAt}:00Z` : null,
      notes: d.notes || null,
    };
    await this.bookings.upsertSegment(d.segmentId, d.segmentId ? row : { ...row, created_by: adminId });
    if (d.kind === "flight") this.notify.send(d.bookingId, "flight_changed", d.title);
  }

  async deleteSegment(segmentId: string) {
    const bookingId = await this.bookings.deleteSegment(segmentId);
    if (!bookingId) throw new NotFoundException("Segment not found.");
    return { bookingId };
  }
}
