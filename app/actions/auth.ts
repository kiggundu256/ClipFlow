"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(128);

export async function register(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");

  const emailResult = emailSchema.safeParse(email);
  const passwordResult = passwordSchema.safeParse(password);

  if (!name || name.length > 80 || !emailResult.success || !passwordResult.success || password !== confirmation) {
    redirect("/register?error=details");
  }

  const baseSlug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36) || "creator";
  const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { name, email, passwordHash: hashPassword(password) }
      });

      const workspace = await tx.workspace.create({
        data: { name: `${name}'s workspace`, slug }
      });

      await tx.membership.create({
        data: { userId: createdUser.id, workspaceId: workspace.id, role: "OWNER" }
      });

      await tx.subscription.create({
        data: { workspaceId: workspace.id, plan: "FREE", status: "ACTIVE" }
      });

      return createdUser;
    });

    await createSession(user.id);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      redirect("/register?error=exists");
    }
    throw error;
  }

  redirect("/");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success || password.length === 0 || password.length > 128) {
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=invalid");
  }

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
