import type { Metadata } from "next";
import { BadgePlus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyWalletNotes } from "@/modules/agencies/queries";
import { WalletNotesTable } from "../wallet-notes-table";

export const metadata: Metadata = { title: "Credit Notes" };

export default async function AgentCreditNotesPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const notes = await getAgencyWalletNotes(membership.agency.id, "credit_note");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Credit Notes</h1>
      </div>
      <WalletNotesTable
        notes={notes}
        emptyIcon={BadgePlus}
        emptyTitle="No credit notes yet"
        emptyDescription="A credit note appears here whenever STS issues one — e.g. goodwill credit or a billing correction."
      />
    </div>
  );
}
