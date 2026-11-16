import { Module } from "@nestjs/common";
import { VisaFollowUpService } from "./visa-follow-up.service";

@Module({
  providers: [VisaFollowUpService],
})
export class VisaModule {}
