import { WaafiWebhookController } from "./waafi-webhook.controller";
import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { AccountPaymentsService } from "./account.service";
import { CheckoutService } from "./checkout.service";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { RazorpayWebhookController } from "./razorpay-webhook.controller";
import { SifaloWebhookController } from "./sifalo-webhook.controller";
import { SifaloService } from "./sifalo.service";
import { WaafiService } from "./waafi.service";
import { OrdersModule } from "../orders/orders.module";
import { AgencyCollectionsService } from "./agency-collections.service";

@Module({
  imports: [OrdersModule],
  controllers: [WaafiWebhookController, StripeWebhookController, RazorpayWebhookController, SifaloWebhookController],
  providers: [PaymentsService, AccountPaymentsService, CheckoutService, SifaloService, WaafiService, AgencyCollectionsService],
  exports: [PaymentsService, AccountPaymentsService, CheckoutService],
})
export class PaymentsModule {}
