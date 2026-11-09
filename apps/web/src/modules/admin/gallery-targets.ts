import { revalidatePath } from "next/cache";
import type { GalleryTarget } from "@/modules/admin/property-gallery-actions";
import { invalidateCache } from "@/lib/redis";

/**
 * Split out of property-gallery-actions.ts: a "use server" file may only
 * export async functions, and this is a plain object — importing it from
 * another "use server" module (admin/actions.ts) broke the production build
 * ("A 'use server' file can only export async functions, found object").
 */
export const TARGETS: Record<"hotel" | "room" | "venue", GalleryTarget> = {
  hotel: {
    table: "hotels",
    bucket: "hotel-images",
    pathPrefix: (id) => `${id}`,
    revalidate: async (id) => {
      await invalidateCache("hotels");
      revalidatePath(`/admin/hotels/${id}`);
      revalidatePath("/admin/hotels");
    },
  },
  room: {
    table: "hotel_rooms",
    bucket: "hotel-images",
    pathPrefix: (id) => `rooms/${id}`,
    revalidate: async () => {
      await invalidateCache("hotels");
      revalidatePath(`/admin/hotels`, "layout");
    },
  },
  venue: {
    table: "event_venues",
    bucket: "venue-images",
    pathPrefix: (id) => `${id}`,
    revalidate: async (id) => {
      await invalidateCache("events");
      revalidatePath(`/admin/events/${id}`);
      revalidatePath("/admin/events");
    },
  },
};
