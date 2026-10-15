"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  ImageIcon,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
    },
  });

  const remove = trpc.travelers.deleteDocument.useMutation({
    onSuccess: () => {
      utils.travelers.myDocuments.invalidate();
      setConfirmDelete(null);
    },
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

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck />
        <AlertDescription>
          Files here are stored privately and are only visible to you. STS staff see a document
          when you attach it to a specific application — never before.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {documents.length === 0
            ? "Your vault is empty."
            : `${documents.length} document${documents.length === 1 ? "" : "s"} stored.`}
        </p>
        <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> Upload document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <FileText className="size-5" />
            </span>
            <p className="font-medium">Upload once, reuse everywhere</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Store a passport scan, photograph or bank statement here and attach it to any visa or
              Umrah application instead of finding and re-uploading it each time.
            </p>
            <Button onClick={() => setUploadOpen(true)} className="mt-1 gap-1.5">
              <Plus className="size-4" /> Upload your first document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const expired = isExpired(doc.expires_at);
            const isImage = doc.content_type?.startsWith("image/");
            const Icon = isImage ? ImageIcon : FileText;

            return (
              <Card key={doc.id}>
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {doc.label || TYPE_LABELS.get(doc.document_type) || "Document"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={doc.file_name}>
                        {doc.file_name}
                        {formatSize(doc.file_size) ? ` · ${formatSize(doc.file_size)}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{TYPE_LABELS.get(doc.document_type)}</Badge>
                    {doc.traveler ? (
                      <Badge variant="outline">
                        {doc.traveler.is_self ? "You" : doc.traveler.full_name}
                      </Badge>
                    ) : null}
                    {doc.expires_at ? (
                      <Badge variant={expired ? "destructive" : "outline"} className="gap-1">
                        {expired ? <AlertTriangle className="size-3" /> : null}
                        {expired ? "Expired" : "Expires"} {doc.expires_at}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-auto flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      render={
                        <a
                          href={`/api/traveler-documents/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <Download className="size-3.5" /> Open
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${doc.file_name}`}
                      onClick={() => setConfirmDelete(doc)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload a document</DialogTitle>
            <DialogDescription>
              JPG, PNG, WebP, HEIC or PDF, up to 10 MB.
            </DialogDescription>
          </DialogHeader>

          <form key={formKey} action={handleUpload} className="space-y-4">
            {upload.error ? (
              <Alert variant="destructive">
                <AlertDescription>{upload.error.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="vault-file">File</Label>
              <FileField
                id="vault-file"
                name="file"
                required
                accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,image/jpeg,image/png,image/webp,image/heic,application/pdf"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vault-type">Document type</Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="vault-traveler">Belongs to</Label>
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vault-label">Label (optional)</Label>
                <Input id="vault-label" name="label" placeholder="e.g. Old passport" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vault-expires">Expires on (optional)</Label>
                <Input id="vault-expires" name="expiresAt" type="date" />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Uploading…">Upload</SubmitButton>
            </div>
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
              {confirmDelete?.file_name} will be permanently removed from your vault. Copies already
              attached to a submitted application stay with that application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && remove.mutate({ documentId: confirmDelete.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {upload.isSuccess ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Document uploaded to your vault.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
