import { NextResponse } from "next/server";
import { apiUrl } from "@/lib/trpc/shared";

/** Stable public callback URL; forward raw bytes and signature headers to the API. */
export async function POST(request: Request) {
  const raw = await request.arrayBuffer();
  if (raw.byteLength > 100_000) return new NextResponse(null, { status: 413 });
  let event: { event?: string };
  try { event = JSON.parse(Buffer.from(raw).toString("utf8")); }
  catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  if (event.event === "webhook.test") return NextResponse.json({ received: true });
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const name of ["x-webhook-timestamp", "x-webhook-event-id", "x-webhook-signature", "x-webhook-signature-alg"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const base = (process.env.API_INTERNAL_URL ?? apiUrl()).replace(/\/$/, "");
    if (!process.env.API_INTERNAL_URL && !base.startsWith("https://")) return NextResponse.json({ error: "Secure payment API not configured" }, { status: 503 });
    const response = await fetch(`${base}/payments/waafi/webhook`, { method: "POST", headers, body: raw, signal: AbortSignal.timeout(15_000) });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch { return NextResponse.json({ error: "Payment confirmation pending" }, { status: 503 }); }
}
