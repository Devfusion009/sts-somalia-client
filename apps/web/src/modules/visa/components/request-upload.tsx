"use client";
import { PortalDocumentUpload } from "./portal-document-upload";
export function RequestUpload({ requestId, applicationId }: { requestId: string; applicationId: string }) {
  return <PortalDocumentUpload applicationId={applicationId} targetId={requestId} kind="request" />;
}
