import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/backend/repository";
import { persistUpload } from "@/lib/backend/upload";
import { BackendError, safeError } from "@/lib/backend/errors";
import { readUploadForm } from "@/lib/backend/multipart";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin)
      throw new BackendError(
        403,
        "This upload must come from the archive application.",
      );
    const { client } = await requireSession();
    return NextResponse.json(
      await persistUpload(client, await readUploadForm(request)),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safe = safeError(error);
    return NextResponse.json(
      { error: safe.message },
      { status: safe.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
