import { NextResponse } from "next/server";

import { releaseExpiredReservations } from "@/features/checkout/expiry";
import { db } from "@/lib/db";

// Backstop sweeper for expired reservations (spec §6.4). Vercel Cron calls
// this on the vercel.json schedule with `Authorization: Bearer $CRON_SECRET`;
// createOrder also sweeps opportunistically, so a slow cron cadence degrades
// gracefully instead of leaking stock.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ released: 0, demo: true });
  }

  const { released } = await releaseExpiredReservations(db);
  return NextResponse.json({ released });
}
