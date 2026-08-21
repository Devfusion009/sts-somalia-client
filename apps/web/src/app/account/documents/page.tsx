import type { Metadata } from "next";
import { getMyDocuments, getMyTravelers } from "@/modules/travelers/queries";
import { DocumentVault } from "@/modules/travelers/components/document-vault";

export const metadata: Metadata = { title: "Document Vault" };

export default async function AccountDocumentsPage() {
  const [documents, travelers] = await Promise.all([getMyDocuments(), getMyTravelers()]);

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
