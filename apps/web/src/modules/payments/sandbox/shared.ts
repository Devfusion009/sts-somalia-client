export const SANDBOX_PATH = "/admin/finance/payments/sandbox";
export const SANDBOX_PROVIDER = "waafi_sandbox_test";
export const SANDBOX_WALLETS = [
  { phone: "252611111111", label: "EVC Plus · 252611111111" },
  { phone: "252631111111", label: "ZAAD · 252631111111" },
  { phone: "252901111111", label: "Sahal · 252901111111" },
] as const;
export type SandboxState = {
  error: string | null;
  success?: string;
  reference?: string;
  amountMinor?: number;
  status?: "pending" | "approved" | "declined" | "failed";
  checkoutUrl?: string;
  transactionId?: string;
};
