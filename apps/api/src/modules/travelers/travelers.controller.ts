import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors, Body } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { User } from "@supabase/supabase-js";
import { TravelersService } from "./travelers.service";

/**
 * Plain REST, multipart — tRPC doesn't carry binary well, so document
 * upload is the one thing in this module that isn't a tRPC procedure
 * (mirrors the reasoning in every prior phase that hit a real file upload).
 */
@Controller("travelers")
export class TravelersController {
  constructor(private readonly travelers: TravelersService) {}

  @Post("documents")
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { documentType?: string; label?: string; travelerId?: string; expiresAt?: string }
  ) {
    if (!file) throw new BadRequestException("Choose a file to upload.");
    return this.travelers.uploadVaultDocument(
      user.id,
      { buffer: file.buffer, originalname: file.originalname, size: file.size, mimetype: file.mimetype },
      {
        documentType: body.documentType || "other",
        label: body.label,
        travelerId: body.travelerId,
        expiresAt: body.expiresAt,
      }
    );
  }
}
