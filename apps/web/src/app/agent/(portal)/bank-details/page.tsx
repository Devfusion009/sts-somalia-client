import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BankDetailsForm } from "./bank-details-form";

export const metadata: Metadata = { title: "Bank Details" };

export default async function AgentBankDetailsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { agency, roleInAgency } = membership;
  const canManage = roleInAgency === "owner" || roleInAgency === "admin";

  const details: { label: string; value: string | null; mono?: boolean }[] = [
    { label: "Bank name", value: agency.bank_name },
    { label: "Account holder name", value: agency.bank_account_name },
    { label: "Branch", value: agency.bank_branch },
    { label: "SWIFT/BIC code", value: agency.bank_swift_code, mono: true },
    { label: "Account number", value: agency.bank_account_number, mono: true },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Bank details"
        status={!canManage ? <Badge variant="neutral">Read only</Badge> : null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Payout account</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <BankDetailsForm
              bankName={agency.bank_name}
              bankAccountName={agency.bank_account_name}
              bankAccountNumber={agency.bank_account_number}
              bankBranch={agency.bank_branch}
              bankSwiftCode={agency.bank_swift_code}
            />
          ) : (
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              {details.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className={item.mono ? "mt-0.5 font-mono font-medium break-all" : "mt-0.5 font-medium break-words"}>
                    {item.value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
