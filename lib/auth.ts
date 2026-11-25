import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSessionToken, getSessionExpiry, hashSessionToken } from "@/lib/session-token";

export { hashPassword, verifyPassword };

const COOKIE_NAME = "clipflow_session";

export async function createSession(userId: string) {
  const token = createSessionToken();
  const expiresAt = getSessionExpiry();

  await prisma.session.create({
    data: { tokenHash: hashSessionToken(token), userId, expiresAt }
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            orderBy: { createdAt: "asc" },
            include: { workspace: true }
          }
        }
      }
    }
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    cookieStore.delete(COOKIE_NAME);
    return null;
  }

  return session.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  cookieStore.delete(COOKIE_NAME);
}
