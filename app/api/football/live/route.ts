import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league");
  const params: Record<string, string> = { live: league ?? "all" };
  try {
    const data = await apiFetch("/fixtures", params, 30);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
