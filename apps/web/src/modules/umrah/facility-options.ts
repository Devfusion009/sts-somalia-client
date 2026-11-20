/** Optional amenities; core flights, hotels, meals and transport use Includes. */
export const UMRAH_FACILITY_OPTIONS = [
  "Airport reception",
  "Haram shuttle",
  "Hotel Wi-Fi",
  "Rawdah booking assistance",
  "Umrah insurance",
  "Dedicated group coordinator",
] as const;

const knownFacilities = new Set<string>(UMRAH_FACILITY_OPTIONS);

export function splitUmrahFacilities(value: string | null | undefined) {
  const lines = (value ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  return {
    selected: lines.filter((line) => knownFacilities.has(line)),
    other: lines.filter((line) => !knownFacilities.has(line)).join("\n"),
  };
}

export function umrahFacilitiesFromForm(formData: FormData) {
  const selected = formData.getAll("facility").map(String).filter((item) => knownFacilities.has(item));
  const other = String(formData.get("facilitiesOther") ?? "").trim();
  return [...new Set(selected), ...(other ? [other] : [])].join("\n");
}
