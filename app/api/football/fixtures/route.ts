import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params: Record<string, string> = {};
  ["league", "season", "date", "from", "to", "team", "round", "status"].forEach((k) => {
    const v = searchParams.get(k);
    if (v) params[k] = v;
  });
  try {
    const data = await apiFetch("/fixtures", params, 60);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
