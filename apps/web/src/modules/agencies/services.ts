/** Canonical desk routes; service intent is restricted to these five keys. */
export const AGENT_SERVICES = [
  { key: "flights", label: "Flights", href: "/agent/book/flights", icon: "flights" },
  { key: "hotels", label: "Hotels", href: "/agent/book/hotels", icon: "hotels" },
  { key: "visa", label: "Visas", href: "/agent/book/visa", icon: "visa" },
  { key: "umrah", label: "Umrah", href: "/agent/book/umrah", icon: "umrah" },
  { key: "events", label: "Events & halls", href: "/agent/book/events", icon: "events" },
] as const;

export function getAgentService(key: string | null | undefined) {
  return AGENT_SERVICES.find((service) => service.key === key);
}

export function agentServiceStartHref(key: string) {
  const service = getAgentService(key);
  return service ? `/agent/book?service=${service.key}` : "/agent/book";
}
