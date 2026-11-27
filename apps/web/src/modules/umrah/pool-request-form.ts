import { submitPoolRequestSchema } from "@sts/shared-types";
/** A batch uses customer-prefixed fields; one customer can request a whole party. */
export function parsePoolRequestForm(form: FormData, customerIds: string[] = []) {
  const group = customerIds.length > 1;
  const ids: Array<string | undefined> = customerIds.length ? customerIds : [undefined];
  return submitPoolRequestSchema.parse({
    departureId: form.get("departure_id"), idempotencyKey: form.get("requestKey"), termsAccepted: form.get("termsAccepted") === "on",
    parties: ids.map(id => {
      const prefix = group ? `c_${id}__` : "";
      const count = group ? 1 : Number(form.get("num_pilgrims"));
      if (!Number.isInteger(count) || count < 1 || count > 60) throw new Error("Choose 1 to 60 pilgrims.");
      const field = (key: string) => String(form.get(`${prefix}${key}`) ?? "").trim() || undefined;
      return {
        agencyCustomerId: id, roomSharing: Number(form.get("room_sharing")) || undefined,
        specialRequests: String(form.get("special_requests") ?? ""),
        pilgrims: Array.from({ length: count }, (_,i) => ({
          full_name: field(`pilgrim_${i}_full_name`), gender: field(`pilgrim_${i}_gender`),
          date_of_birth: field(`pilgrim_${i}_date_of_birth`), nationality: field(`pilgrim_${i}_nationality`),
          passport_number: field(`pilgrim_${i}_passport_number`), passport_expiry: field(`pilgrim_${i}_passport_expiry`),
          mahram_name: field(`pilgrim_${i}_mahram_name`), mahram_relation: field(`pilgrim_${i}_mahram_relation`),
        })),
      };
    }),
  });
}
