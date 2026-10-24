import type { Metadata } from "next";
import { getServerTrpc } from "@/lib/trpc/server";
import { DocumentVault } from "@/modules/travelers/components/document-vault";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";

export const metadata: Metadata = { title: "Document Vault" };

export default async function AccountDocumentsPage() {
  const trpc = await getServerTrpc();
  // apps/api is a separate deployment (not yet reachable from every
  // environment) — an empty vault here would read as "you have no documents
  // saved", which may be false, so this page blocks rather than degrades.
  let documents, travelers;
  try {
    [documents, travelers] = await Promise.all([
      trpc.travelers.myDocuments.query(),
      trpc.travelers.myTravelers.query(),
    ]);
  } catch {
    return <UnavailableNotice label="Document Vault" />;
  }

  // DocumentVault owns the page header: its "Upload document" action opens
  // the dialog it holds.
  return (
    <div className="mx-auto w-full max-w-3xl">
      <DocumentVault documents={documents} travelers={travelers} />
    </div>
  );
}
