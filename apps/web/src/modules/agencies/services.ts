/** Canonical desk routes; service intent is restricted to these five keys. */
export const AGENT_SERVICES = [
  { key: "flights", label: "Flights", action: "Request quote", href: "/agent/book/flights", icon: "flights" },
  { key: "hotels", label: "Hotels", action: "Find rooms", href: "/agent/book/hotels", icon: "hotels" },
  { key: "visa", label: "Visas", action: "Start application", href: "/agent/book/visa", icon: "visa" },
  { key: "umrah", label: "Umrah", action: "View packages", href: "/agent/book/umrah", icon: "umrah" },
  { key: "events", label: "Events & halls", action: "Find venue", href: "/agent/book/events", icon: "events" },
] as const;

export const AGENT_BOOKING_STEPS = ["Service", "Customer", "Travel details", "Review & pay"] as const;

export function getAgentService(key: string | null | undefined) {
  return AGENT_SERVICES.find((service) => service.key === key);
}

export function agentServiceStartHref(key: string) {
  const service = getAgentService(key);
  return service ? `/agent/book?service=${service.key}` : "/agent/book";
}
