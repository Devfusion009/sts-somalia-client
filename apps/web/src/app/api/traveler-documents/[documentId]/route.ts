import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpc } from "@/lib/trpc/server";

/**
 * Redirects to a short-lived signed URL for one vault document.
 *
 * Mirrors /api/invoices/[orderId]: the private bucket is never exposed
 * directly, and the signed URL is minted per request against the caller's own
 * session, so a stale link can't be replayed later.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  await requireUser();
  const { documentId } = await params;

  const trpc = await getServerTrpc();
  const url = await trpc.travelers.documentDownloadUrl.query({ documentId });
  if (!url) {
    // Deliberately the same response whether the document belongs to someone
    // else or doesn't exist — distinguishing them would confirm which ids are
    // real to anyone probing.
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.redirect(url);
}
