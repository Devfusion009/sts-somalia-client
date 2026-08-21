import type { Metadata } from "next";
import { BadgeMinus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyWalletNotes } from "@/modules/agencies/queries";
import { WalletNotesTable } from "../wallet-notes-table";

export const metadata: Metadata = { title: "Debit Notes" };

export default async function AgentDebitNotesPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const notes = await getAgencyWalletNotes(membership.agency.id, "debit_note");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Debit Notes</h1>
      </div>
      <WalletNotesTable
        notes={notes}
        emptyIcon={BadgeMinus}
        emptyTitle="No debit notes yet"
        emptyDescription="A debit note appears here whenever STS charges the wallet directly — e.g. a late-cancellation fee."
      />
    </div>
  );
}
