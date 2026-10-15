import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { AccountPaymentsService } from "./account.service";
import { CheckoutService } from "./checkout.service";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { RazorpayWebhookController } from "./razorpay-webhook.controller";
import { OrdersModule } from "../orders/orders.module";

@Module({
  imports: [OrdersModule],
  controllers: [StripeWebhookController, RazorpayWebhookController],
  providers: [PaymentsService, AccountPaymentsService, CheckoutService],
  exports: [PaymentsService, AccountPaymentsService, CheckoutService],
})
export class PaymentsModule {}
