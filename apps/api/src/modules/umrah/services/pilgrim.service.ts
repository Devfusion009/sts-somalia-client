import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { HAND_IN_LABEL, HAND_IN_TYPES, pilgrimErrorMessage, type HandInType, type UpdatePilgrimInput } from "@sts/shared-types";
import { UmrahBookingRepository } from "../repositories/umrah-booking.repository";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export type UploadedFile = { buffer: Buffer; originalname: string; size: number; mimetype: string };

export function assertDocumentFile(file: UploadedFile | undefined): UploadedFile {
  if (!file || file.size === 0) throw new BadRequestException("Choose a file to upload.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new BadRequestException("Files must be 10MB or smaller.");
  if (!DOCUMENT_TYPES.includes(file.mimetype)) throw new BadRequestException("Upload a PDF, JPG, PNG or WebP file.");
  return file;
}

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

/**
 * Pilgrim details and the documents a traveller (or their agent) hands in.
 * update_umrah_pilgrim decides who may edit and when; customer files land
 * under {booking}/customer/... where the storage policy lets them write.
 */
@Injectable()
export class PilgrimService {
  constructor(private readonly bookings: UmrahBookingRepository) {}

  async update(input: UpdatePilgrimInput) {
    const { pilgrimId, ...patch } = input;
    const clean = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v ?? ""]));
    const error = await this.bookings.updatePilgrim(pilgrimId, clean);
    if (error) throw new BadRequestException(pilgrimErrorMessage(error.message));
  }

  async uploadHandIn(userId: string, bookingId: string, pilgrimId: string, docType: string, file: UploadedFile | undefined) {
    if (!(HAND_IN_TYPES as readonly string[]).includes(docType)) throw new BadRequestException("Choose a document type.");
    const checked = assertDocumentFile(file);
    const pilgrim = await this.bookings.findPilgrimOnBooking(pilgrimId, bookingId);
    if (!pilgrim) throw new NotFoundException("Pilgrim not found on this booking.");

    const path = `${bookingId}/customer/${pilgrimId}/${docType}-${Date.now()}-${safeFileName(checked.originalname)}`;
    if (await this.bookings.uploadDocument(path, checked.buffer, checked.mimetype)) {
      throw new BadRequestException("Uploads are closed for this booking.");
    }
    const error = await this.bookings.insertDocument({
      booking_id: bookingId,
      pilgrim_id: pilgrimId,
      doc_type: docType,
      title: `${HAND_IN_LABEL[docType as HandInType]} — ${pilgrim.full_name}`.slice(0, 120),
      storage_path: path,
      file_name: checked.originalname,
      file_size: checked.size,
      content_type: checked.mimetype,
      uploaded_by: userId,
      source: "customer",
      review_status: "pending",
    });
    if (error) {
      await this.bookings.removeStorage([path]);
      throw new BadRequestException("Uploads are closed for this booking.");
    }
  }

  /** Only a customer's own file still waiting for review can be withdrawn. */
  async deleteHandIn(documentId: string) {
    const doc = await this.bookings.deletePendingCustomerDocument(documentId);
    if (!doc) throw new BadRequestException("This document can no longer be removed.");
    await this.bookings.removeStorage([doc.storage_path]);
  }
}
