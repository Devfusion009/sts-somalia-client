import { createLucideIcon } from "lucide-react";

/** Kaaba silhouette, distinct from hotel and finance icons at small sizes. */
export const UmrahIcon = createLucideIcon("Umrah", [
  ["path", { d: "m4 6 10-3 6 3v13l-10 3-6-3Z", key: "outline" }],
  ["path", { d: "m4 6 6 3 10-3M10 9v13", key: "edges" }],
  ["path", { d: "m4 10 6 3 10-3M4 12l6 3 10-3", key: "band" }],
  ["path", { d: "M14 20.8v-5l3-.9v5", key: "door" }],
]);
