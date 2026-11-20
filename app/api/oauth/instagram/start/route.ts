import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createInstagramAuthorizationUrl } from "@/lib/oauth/instagram";

export const runtime = "nodejs";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl));

  const membership = user.memberships[0];
  if (!membership) return NextResponse.redirect(new URL("/register", appUrl));

  try {
    const url = await createInstagramAuthorizationUrl(user.id, membership.workspaceId);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/channels?error=instagram_configuration", appUrl));
  }
}
