import { NextResponse } from "next/server";
import { loadWorkspace } from "@/lib/backend/repository";
import { safeError } from "@/lib/backend/errors";
export async function GET() {
  try {
    return NextResponse.json(await loadWorkspace(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const safe = safeError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
