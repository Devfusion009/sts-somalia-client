"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireHotelPermission, revalidateHotelDesk } from "@/modules/hotels/hotel-access";

export type RateActionState = { error: string | null } | null;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

const ruleSchema = z
  .object({
    hotelId: z.string().uuid(),
    roomId: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Enter a name.").max(80, "Keep the name under 80 characters."),
    dateStart: isoDate,
    dateEnd: isoDate,
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7),
    adjustment: z.enum(["percent", "fixed"]),
    value: z.coerce.number(),
  })
  .refine((d) => d.dateEnd >= d.dateStart, { message: "End date must be on or after the start date.", path: ["dateEnd"] })
  .refine((d) => d.adjustment !== "percent" || (d.value > -100 && d.value <= 1000), {
    message: "Percent change must be between -99 and 1000.",
    path: ["value"],
  })
  .refine((d) => d.adjustment !== "fixed" || d.value > 0, { message: "Price must be greater than zero.", path: ["value"] });

export async function addRateRule(_prev: RateActionState, formData: FormData): Promise<RateActionState> {
  const parsed = ruleSchema.safeParse({
    hotelId: formData.get("hotelId"),
    roomId: formData.get("roomId")?.toString() || undefined,
    name: formData.get("name"),
    dateStart: formData.get("dateStart"),
    dateEnd: formData.get("dateEnd"),
    weekdays: formData.getAll("weekdays"),
    adjustment: formData.get("adjustment"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { hotelId, roomId, name, dateStart, dateEnd, weekdays, adjustment, value } = parsed.data;

  const access = await requireHotelPermission(hotelId, "rooms");
  if (!access) {
    return { error: "You don't have permission to edit rates." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("hotel_rate_rules").insert({
    hotel_id: hotelId,
    room_id: roomId ?? null,
    name,
    date_start: dateStart,
    date_end: dateEnd,
    weekdays: weekdays.length > 0 && weekdays.length < 7 ? weekdays : null,
    adjustment,
    value,
    created_by: access.profileId,
  });
  if (error) return { error: error.message };

  revalidateHotelDesk(hotelId);
  return { error: null };
}

export async function deleteRateRule(formData: FormData): Promise<void> {
  const ruleId = z.string().uuid().safeParse(formData.get("ruleId"));
  const hotelId = z.string().uuid().safeParse(formData.get("hotelId"));
  if (!ruleId.success || !hotelId.success) return;

  if (!(await requireHotelPermission(hotelId.data, "rooms"))) return;

  const supabase = await createClient();
  await supabase.from("hotel_rate_rules").delete().eq("id", ruleId.data).eq("hotel_id", hotelId.data);
  revalidateHotelDesk(hotelId.data);
}
