import { PaymentWorkspace } from "@/modules/payments/components/payment-workspace";
export const metadata = { title: "Agency payments" };
export default function Page() { return <PaymentWorkspace scope="agency" />; }
