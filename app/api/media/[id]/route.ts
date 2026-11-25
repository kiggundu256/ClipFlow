import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findWorkspaceMediaAsset } from "@/lib/workspace-access";

export const runtime = "nodejs";

function mediaDirectory() {
  return resolve(process.env.CLIPFLOW_MEDIA_DIR || join(process.cwd(), "private-media"));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const membership = user.memberships[0];
  if (!membership) return new NextResponse("Workspace not found", { status: 404 });

  const { id } = await context.params;
  const asset = await findWorkspaceMediaAsset(membership.workspaceId, id);
  if (!asset) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readFile(join(mediaDirectory(), asset.storageKey));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return new NextResponse("Media file unavailable", { status: 404 });
  }
}
