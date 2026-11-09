import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserForPortal } from "@/lib/auth/session";
import { portalHref } from "@/lib/subdomain";
import { getMyAgency } from "@/modules/agencies/queries";
import { reconcileWaafiTopup } from "@/modules/payments/waafi-topup";

export async function GET(request: Request) {
  const profile = await requireUserForPortal("agent");
  const membership = await getMyAgency(profile.id);
  const topupId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("topupId"));
  const base = `${portalHref("agent")}/finance/top-up`;
  if (!membership || membership.agency.status === "suspended" || !topupId.success) redirect(base);
  const status = await reconcileWaafiTopup(topupId.data, membership.agency.id);
  redirect(`${base}?status=${status === "unavailable" ? "pending" : status}&topupId=${topupId.data}`);
}
