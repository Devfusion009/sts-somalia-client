"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, FileText, FolderLock, ImageIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { shortDate } from "@/lib/money";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import { apiUrl } from "@/lib/trpc/shared";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TRAVELER_DOCUMENT_TYPES } from "../schemas";
import type { TravelerProfile, VaultDocument } from "../queries";
import { FileField } from "@/components/ui/upload";

/**
 * Plain REST multipart POST, not a tRPC mutation — tRPC doesn't carry
 * binary well (same reasoning as every prior phase's real file upload).
 * Still goes through @tanstack/react-query's useMutation below so it gets
 * the same pending/error/success shape as the tRPC mutations elsewhere on
 * this page, and can still invalidate the tRPC-cached documents query on
 * success.
 */
async function uploadDocument(formData: FormData) {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${apiUrl()}/travelers/documents`, {
    method: "POST",
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Upload failed.");
  }
  return res.json();
}

const TYPE_LABELS = new Map(TRAVELER_DOCUMENT_TYPES.map((t) => [t.value, t.label]));

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return Date.parse(`${expiresAt.slice(0, 10)}T00:00:00Z`) < Date.now();
}

export function DocumentVault({
  documents,
  travelers,
}: {
  documents: VaultDocument[];
  travelers: TravelerProfile[];
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<VaultDocument | null>(null);
  const utils = trpc.useUtils();

  const upload = useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      utils.travelers.myDocuments.invalidate();
      setUploadOpen(false);
      setFormKey((k) => k + 1);
      toast.success("Document uploaded.");
    },
  });

  const remove = trpc.travelers.deleteDocument.useMutation({
    onSuccess: () => {
      utils.travelers.myDocuments.invalidate();
      setConfirmDelete(null);
      toast.success("Document deleted.");
    },
    onError: (error) => toast.error(error.message),
  });

  // Bumped on every successful upload to remount the form. A file input cannot
  // be cleared by re-rendering — its value is owned by the browser — and
  // calling formRef.current.reset() here would be reading a ref during render.
  // Remounting is the one approach that is both correct and legal.
  const [formKey, setFormKey] = useState(0);

  async function handleUpload(formData: FormData) {
    try {
      await upload.mutateAsync(formData);
    } catch {
      // handled via upload.error below
    }
  }

  const travelerItems = [
    { value: "", label: "Not tied to one person" },
    ...travelers.map((t) => ({
      value: t.id,
      label: t.is_self ? `${t.full_name} (you)` : t.full_name,
    })),
  ];

  const typeItems = TRAVELER_DOCUMENT_TYPES.map((t) => ({ value: t.value, label: t.label }));

  const uploadButton = (
    <Button onClick={() => setUploadOpen(true)}>
      <Plus data-icon="inline-start" /> Upload document
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document vault"
        status={documents.length > 0 ? <Badge variant="secondary">{documents.length}</Badge> : null}
        actions={uploadButton}
      />

      {documents.length === 0 ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderLock />
              </EmptyMedia>
              <EmptyTitle>No documents</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>{uploadButton}</EmptyContent>
          </Empty>
        </Card>
      ) : (
        <Card className="py-0">
          <ul className="divide-y divide-border">
            {documents.map((doc) => {
              const expired = isExpired(doc.expires_at);
              const isImage = doc.content_type?.startsWith("image/");
              const Icon = isImage ? ImageIcon : FileText;
              const name = doc.label || TYPE_LABELS.get(doc.document_type) || "Document";
              const size = formatSize(doc.file_size);

              return (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{name}</p>
                    <p className="truncate text-sm text-muted-foreground" title={doc.file_name}>
                      {[
                        TYPE_LABELS.get(doc.document_type) !== name ? TYPE_LABELS.get(doc.document_type) : null,
                        doc.traveler ? (doc.traveler.is_self ? "You" : doc.traveler.full_name) : null,
                        doc.file_name,
                        size,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {doc.expires_at ? (
                      <Badge variant={expired ? "destructive" : "neutral"} className="mt-1.5 tabular-nums">
                        {expired ? "Expired" : "Expires"} {shortDate(doc.expires_at)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Download ${doc.file_name}`}
                      title="Download"
                      render={
                        <a
                          href={`/api/traveler-documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <Download />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Delete ${doc.file_name}`}
                      title="Delete"
                      onClick={() => setConfirmDelete(doc)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
          </DialogHeader>

          <form key={formKey} action={handleUpload}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="vault-file">File</FieldLabel>
                <FileField
                  id="vault-file"
                  name="file"
                  required
                  maxBytes={10 * 1024 * 1024}
                  accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,image/jpeg,image/png,image/webp,image/heic,application/pdf"
                />
              </Field>

              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="vault-type">Document type</FieldLabel>
                  <Select name="documentType" defaultValue="passport_bio" items={typeItems}>
                    <SelectTrigger id="vault-type" className="w-full">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="vault-traveler">Belongs to</FieldLabel>
                  <Select name="travelerId" defaultValue="" items={travelerItems}>
                    <SelectTrigger id="vault-traveler" className="w-full">
                      <SelectValue placeholder="Not tied to one person" />
                    </SelectTrigger>
                    <SelectContent>
                      {travelerItems.map((item) => (
                        <SelectItem key={item.value || "none"} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="vault-label">Label</FieldLabel>
                  <Input id="vault-label" name="label" placeholder="Optional, e.g. Old passport" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="vault-expires">Expires on</FieldLabel>
                  <Input id="vault-expires" name="expiresAt" type="date" />
                </Field>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
                {upload.error ? (
                  <p role="alert" className="text-sm text-destructive sm:mr-auto">
                    {upload.error.message}
                  </p>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton pendingText="Uploading…">Upload</SubmitButton>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.file_name} is permanently removed from your vault.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={remove.isPending}
              onClick={() => confirmDelete && remove.mutate({ documentId: confirmDelete.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
