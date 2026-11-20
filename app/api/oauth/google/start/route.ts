import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGoogleAuthorizationUrl } from "@/lib/oauth/google";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));

  const membership = user.memberships[0];
  if (!membership) return NextResponse.redirect(new URL("/register", process.env.NEXT_PUBLIC_APP_URL));

  try {
    const url = await createGoogleAuthorizationUrl(user.id, membership.workspaceId);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/channels?error=configuration", process.env.NEXT_PUBLIC_APP_URL));
  }
}
