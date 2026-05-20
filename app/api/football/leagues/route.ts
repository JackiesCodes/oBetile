import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params: Record<string, string> = {};
  ["country", "season", "type"].forEach((k) => {
    const v = searchParams.get(k);
    if (v) params[k] = v;
  });
  try {
    const data = await apiFetch("/leagues", params, 3600);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
