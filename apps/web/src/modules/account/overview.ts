export function profileCompletion(profile: {full_name?: string | null; email?: string | null; phone?: string | null; country_code?: string | null}) {
  return Math.round([profile.full_name,profile.email,profile.phone,profile.country_code].filter(value=>Boolean(value?.trim())).length / 4 * 100);
}
export function maskedPassport(value: string | null | undefined) {
  if(!value) return "Not added";
  return value.length <= 4 ? "•".repeat(value.length) : `•••• ${value.slice(-4)}`;
}
export function passportState(expiry: string | null | undefined, number: string | null | undefined, now = Date.now()) {
  if(!number) return "Not added";
  if(!expiry) return "Details incomplete";
  const end = Date.parse(`${expiry}T23:59:59Z`);
  if(!Number.isFinite(end)) return "Details incomplete";
  if(end < now) return "Expired";
  if(end-now < 90*86400000) return "Expiring soon";
  return "Details saved";
}
