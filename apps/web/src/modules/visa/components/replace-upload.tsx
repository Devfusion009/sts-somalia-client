"use client";
import { PortalDocumentUpload } from "./portal-document-upload";
export function ReplaceUpload({ documentId, applicationId }: { documentId: string; applicationId: string }) {
  return <PortalDocumentUpload applicationId={applicationId} targetId={documentId} kind="replace" />;
}
