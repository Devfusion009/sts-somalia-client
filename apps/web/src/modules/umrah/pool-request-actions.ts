"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, requireUser } from "@/lib/auth/session";
import { getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";
import type { ActionState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export async function configureRequestPool(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.poolRequests.configure.mutate({
      departureId: String(form.get("departureId")),
      formationClosesAt: new Date(`${form.get("formationClosesAt")}:00+03:00`).toISOString(),
      paymentCutoffAt: new Date(`${form.get("paymentCutoffAt")}:00+03:00`).toISOString(),
      paymentWindowHours: Number(form.get("paymentWindowHours")), terms: String(form.get("terms")),
    });
  } catch (error) { return { error: trpcErrorMessage(error, "Pool configuration could not be saved.") }; }
  revalidatePath("/admin/umrah/pool", "layout");
  revalidatePath("/admin/catalog/umrah", "layout");
  return { error: null };
}
export async function withdrawPoolRequest(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  try { await (await getServerTrpcForActions()).umrah.poolRequests.withdraw.mutate({ requestId: String(form.get("requestId")) }); }
  catch (error) { return { error: trpcErrorMessage(error, "Request could not be withdrawn.") }; }
  revalidatePath("/account", "layout"); revalidatePath("/agent", "layout"); revalidatePath("/admin/umrah/pool", "layout");
  return { error: null };
}

export async function poolAdminOperation(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  try {
    const trpc=await getServerTrpcForActions();
    if(form.get("operation")==="retry_email") await trpc.umrah.poolRequests.resend.mutate({jobId:String(form.get("target"))});
    else if(form.get("operation")==="open_replacements") await trpc.umrah.poolRequests.openReplacements.mutate({departureId:String(form.get("target"))});
    else if(form.get("operation")==="confirm") {
      const { error } = await (await createClient()).rpc("admin_confirm_umrah_pool", { p_departure: String(form.get("target")) });
      if (error) throw error;
    }
    else return {error:"Unknown operation."};
  } catch(error) { return {error:trpcErrorMessage(error,"The operation could not be completed.")}; }
  revalidatePath("/admin/umrah/pool","layout"); revalidatePath("/admin/umrah/bookings","layout"); revalidatePath("/umrah","layout");
  return {error:null};
}
