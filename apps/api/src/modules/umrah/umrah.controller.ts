import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import type { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RequirePlatformAdmin } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PilgrimService } from "./services/pilgrim.service";
import { FulfillmentAdminService } from "./services/fulfillment-admin.service";

/** Multipart uploads — the one transport tRPC doesn't carry. */
@Controller("umrah")
export class UmrahController {
  constructor(
    private readonly pilgrims: PilgrimService,
    private readonly fulfillment: FulfillmentAdminService
  ) {}

  /** A traveller or their agent hands in a passport copy, photo or certificate. */
  @Post("pilgrim-documents")
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async handIn(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { bookingId?: string; pilgrimId?: string; docType?: string }
  ) {
    await this.pilgrims.uploadHandIn(user.id, body.bookingId ?? "", body.pilgrimId ?? "", body.docType ?? "", file);
    return { ok: true };
  }

  /** Staff attach a visa, ticket, voucher or other travel document. */
  @Post("documents")
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @RequirePlatformAdmin()
  @UseInterceptors(FileInterceptor("file"))
  async staffDocument(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { bookingId?: string; docType?: string; title?: string; pilgrimId?: string }
  ) {
    await this.fulfillment.uploadStaffDocument(
      user.id,
      { bookingId: body.bookingId ?? "", docType: body.docType ?? "", title: body.title ?? "", pilgrimId: body.pilgrimId || undefined },
      file
    );
    return { ok: true };
  }
}
