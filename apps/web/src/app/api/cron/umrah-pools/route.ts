import { NextResponse } from "next/server";
import { processUmrahPools } from "@/modules/umrah/pool-worker";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret=process.env.CRON_SECRET;
  if(!secret || request.headers.get("authorization")!==`Bearer ${secret}`) return new NextResponse("Unauthorized",{status:401});
  try { return NextResponse.json(await processUmrahPools()); }
  catch { return NextResponse.json({error:"Umrah pool processing failed."},{status:500}); }
}
