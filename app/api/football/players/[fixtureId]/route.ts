import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";

export async function GET(
  _req: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  try {
    const data = await apiFetch("/fixtures/players", { fixture: params.fixtureId }, 60);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
