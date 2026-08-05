import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  try {
    const data = await apiFetch("/fixtures/players", { fixture: fixtureId }, 60);
    return NextResponse.json(data);
  } catch (e) {
    return apiErrorResponse(e);
  }
}
