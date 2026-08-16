import { NextResponse } from "next/server";

// Polled by the Docker healthcheck (docker-compose.yml) — a container that
// boots but can't actually serve requests should be reported unhealthy,
// not silently kept in rotation. Same role a load balancer's health probe
// plays in real cloud deployments.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
