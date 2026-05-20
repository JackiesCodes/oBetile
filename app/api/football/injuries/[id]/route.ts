import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await apiFetch("/injuries", { fixture: params.id }, 3600);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
