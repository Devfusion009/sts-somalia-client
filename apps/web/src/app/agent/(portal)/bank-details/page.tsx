import type { Metadata } from "next";
import { Info, Landmark } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BankDetailsForm } from "./bank-details-form";

export const metadata: Metadata = { title: "Bank Details" };

export default async function AgentBankDetailsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { agency, roleInAgency } = membership;
  const canManage = roleInAgency === "owner" || roleInAgency === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Bank Details</h1>
      </div>

      {!canManage ? (
        <Alert>
          <Info />
          <AlertDescription>Only the agency owner or an admin can edit bank details. You have read-only access.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="size-4 text-primary" /> Payout account
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <BankDetailsForm
              bankName={agency.bank_name}
              bankAccountName={agency.bank_account_name}
              bankAccountNumber={agency.bank_account_number}
            />
          ) : (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Bank name</dt>
                <dd className="font-medium">{agency.bank_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account holder name</dt>
                <dd className="font-medium">{agency.bank_account_name ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Account number</dt>
                <dd className="font-medium">{agency.bank_account_number ?? "—"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
