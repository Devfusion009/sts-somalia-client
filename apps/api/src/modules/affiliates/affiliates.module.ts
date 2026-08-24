import { Module } from "@nestjs/common";
import { AffiliatesService } from "./affiliates.service";

/**
 * No controller — tRPC (affiliates.router.ts) is the only transport for
 * this module, unlike phase 0's health module which kept a REST path
 * specifically to prove REST/tRPC parity once. tRPC is the chosen
 * long-term protocol; real modules don't need to maintain two parallel
 * implementations of the same procedures.
 */
@Module({
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
