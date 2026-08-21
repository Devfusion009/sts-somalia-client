"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60] as const;

const eventSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(2, "Give the event a title."),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(200).optional(),
    date: z.string().min(1, "Choose a date."),
    startTime: z.string().min(1, "Choose a start time."),
    endTime: z.string().min(1, "Choose an end time."),
    reminderMinutes: z.coerce
      .number()
      .refine((v) => (REMINDER_OPTIONS as readonly number[]).includes(v), "Invalid reminder option."),
  })
  .transform((d) => ({
    ...d,
    startAt: new Date(`${d.date}T${d.startTime}:00`),
    endAt: new Date(`${d.date}T${d.endTime}:00`),
  }));

export async function saveAdminCalendarEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePlatformAdmin();
  const parsed = eventSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    reminderMinutes: formData.get("reminderMinutes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (Number.isNaN(d.startAt.getTime()) || Number.isNaN(d.endAt.getTime())) {
    return { error: "Enter a valid date and time." };
  }
  if (d.endAt <= d.startAt) {
    return { error: "End time must be after the start time." };
  }

  const supabase = await createClient();
  const payload = {
    title: d.title,
    description: d.description || null,
    location: d.location || null,
    start_at: d.startAt.toISOString(),
    end_at: d.endAt.toISOString(),
    reminder_minutes_before: d.reminderMinutes === 0 ? null : d.reminderMinutes,
    // Editing the time reopens the reminder window — otherwise moving an
    // already-reminded event later would silently never remind again.
    reminder_sent_at: null,
  };

  const { error } = d.id
    ? await supabase.from("admin_calendar_events").update(payload).eq("id", d.id)
    : await supabase.from("admin_calendar_events").insert({ ...payload, created_by: profile.id });
  if (error) return { error: error.message };

  revalidatePath("/admin/calendar");
  return { error: null };
}

export async function deleteAdminCalendarEvent(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("admin_calendar_events").delete().eq("id", id);
  revalidatePath("/admin/calendar");
}
