import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { BankAccountManager } from "./bank-details-form";

export const metadata: Metadata = { title: "Bank Details" };

export default async function AgentBankDetailsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { agency, roleInAgency } = membership;
  const canManage = roleInAgency === "owner" || roleInAgency === "admin";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Bank details"
        status={!canManage ? <Badge variant="neutral">Read only</Badge> : null}
      />
      <div className="rounded-2xl border border-border bg-card shadow-xs">
        <BankAccountManager
        canManage={canManage}
        account={{
          bankName: agency.bank_name,
          bankAccountName: agency.bank_account_name,
          bankAccountNumber: agency.bank_account_number,
          bankBranch: agency.bank_branch,
          bankSwiftCode: agency.bank_swift_code,
        }}
        />
      </div>
    </div>
  );
}
