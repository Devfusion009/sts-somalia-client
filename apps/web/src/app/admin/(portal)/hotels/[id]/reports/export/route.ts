import { requirePlatformAdmin } from "@/lib/auth/session";
import { reportCsv } from "@/modules/hotels/views/exports";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin();
  return reportCsv(id, new URL(request.url).searchParams.get("range") ?? undefined);
}
