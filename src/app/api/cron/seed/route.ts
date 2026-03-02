import { seedAllLocalizations } from "@/lib/db/seed-localizations";
import { fetchAndStoreSets } from "@/lib/db/seed";
import { NextResponse } from "next/server";

// Allow up to 5 minutes for this cron function to run (requires Vercel Pro / Fluid compute)
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await fetchAndStoreSets();
    await seedAllLocalizations();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[cron/seed] Failed:", error);
    return NextResponse.json({ error: "Seeding failed" }, { status: 500 });
  }
}
