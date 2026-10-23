"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";

export type DepartureActionState = {
  error: string | null;
  message?: string;
  skipped?: { reference: string; reason: string }[];
} | null;

function revalidateDeparture(departureId?: string | null) {
  revalidatePath("/admin/umrah/departures");
  if (departureId) revalidatePath(`/admin/umrah/departures/${departureId}`);
  revalidatePath("/admin/umrah/bookings", "layout");
}

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Releases seats held by unpaid group bookings and expired holds, now. */
export async function releaseUnpaidUmrahSeats(): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  try {
    const { message } = await (await getServerTrpcForActions()).umrah.admin.departures.releaseUnpaid.mutate();
    revalidateDeparture();
    return { error: null, message };
  } catch (error) {
    return { error: trpcErrorMessage(error, "Seats could not be released.") };
  }
}

export async function cancelUmrahDeparture(_prev: DepartureActionState, formData: FormData): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const departureId = str(formData, "departureId");
  try {
    await (await getServerTrpcForActions()).umrah.admin.departures.cancel.mutate({ departureId, reason: str(formData, "reason") });
  } catch (error) {
    return { error: trpcErrorMessage(error, "The departure could not be cancelled.") };
  }
  revalidateDeparture(departureId);
  revalidatePath("/admin/refunds");
  return { error: null };
}

/** Moves every live booking behind `stage` forward, each checked as a single move would be. */
export async function advanceDepartureBookings(_prev: DepartureActionState, formData: FormData): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const departureId = str(formData, "departureId");
  try {
    const result = await (await getServerTrpcForActions()).umrah.admin.departures.advance.mutate({
      departureId,
      stage: str(formData, "stage") as "confirmed",
    });
    revalidateDeparture(departureId);
    return { error: null, ...result };
  } catch (error) {
    return { error: trpcErrorMessage(error, "Bookings could not be moved.") };
  }
}

export async function createUmrahRoom(_prev: DepartureActionState, formData: FormData): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  const departureId = str(formData, "departureId");
  try {
    await (await getServerTrpcForActions()).umrah.admin.departures.createRoom.mutate({
      departureId,
      city: str(formData, "city") as "makkah",
      label: str(formData, "label"),
      capacity: Number(formData.get("capacity")),
      gender: (str(formData, "gender") || null) as "male" | null,
    });
  } catch (error) {
    return { error: trpcErrorMessage(error, "The room could not be added.") };
  }
  revalidateDeparture(departureId);
  return { error: null };
}

export async function deleteUmrahRoom(_prev: DepartureActionState, formData: FormData): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  try {
    const { departureId } = await (await getServerTrpcForActions()).umrah.admin.departures.deleteRoom.mutate({ roomId: str(formData, "roomId") });
    revalidateDeparture(departureId);
    return { error: null };
  } catch (error) {
    return { error: trpcErrorMessage(error, "The room could not be removed.") };
  }
}

/** A pilgrim, or every pilgrim of one booking (`booking:<id>`), into a room — all fit or none are added. */
export async function assignRoomOccupants(_prev: DepartureActionState, formData: FormData): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  try {
    const { departureId } = await (await getServerTrpcForActions()).umrah.admin.departures.assign.mutate({
      roomId: str(formData, "roomId"),
      target: str(formData, "target"),
    });
    revalidateDeparture(departureId);
    return { error: null };
  } catch (error) {
    return { error: trpcErrorMessage(error, "The room could not be updated.") };
  }
}

export async function removeRoomOccupant(_prev: DepartureActionState, formData: FormData): Promise<DepartureActionState> {
  await requirePlatformAdmin();
  try {
    await (await getServerTrpcForActions()).umrah.admin.departures.removeOccupant.mutate({
      roomId: str(formData, "roomId"),
      pilgrimId: str(formData, "pilgrimId"),
    });
  } catch (error) {
    return { error: trpcErrorMessage(error, "The room could not be updated.") };
  }
  revalidateDeparture(str(formData, "departureId") || undefined);
  return { error: null };
}
