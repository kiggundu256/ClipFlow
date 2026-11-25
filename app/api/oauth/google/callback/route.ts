import { NextRequest, NextResponse } from "next/server";
import { completeGoogleAuthorization } from "@/lib/oauth/google";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "");
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/channels?error=authorization", appUrl));
  }

  try {
    await completeGoogleAuthorization(code, state);
    return NextResponse.redirect(new URL("/channels?connected=youtube", appUrl));
  } catch {
    return NextResponse.redirect(new URL("/channels?error=connection", appUrl));
  }
}
