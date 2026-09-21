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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Document Vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Store passports, photos and supporting paperwork once, then attach them to any visa or
          Umrah application without uploading again.
        </p>
      </div>

      <DocumentVault documents={documents} travelers={travelers} />
    </div>
  );
}
