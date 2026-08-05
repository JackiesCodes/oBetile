import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-football";
import { apiErrorResponse } from "@/lib/api-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const data = await apiFetch("/fixtures/lineups", { fixture: id }, 300);
    return NextResponse.json(data);
  } catch (e) {
    return apiErrorResponse(e);
  }
}
