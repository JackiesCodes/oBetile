import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const h2h = searchParams.get("h2h");
  if (!h2h) return NextResponse.json({ error: "h2h param required" }, { status: 400 });
  try {
    const data = await apiFetch("/fixtures/headtohead", { h2h, last: "10" }, 3600);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
