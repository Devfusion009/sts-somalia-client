import { requirePlatformAdmin } from "@/lib/auth/session";
import { guestsCsv } from "@/modules/hotels/views/exports";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin();
  return guestsCsv(id);
}
