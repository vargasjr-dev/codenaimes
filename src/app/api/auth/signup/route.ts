import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { users } from "@data/schema";
import { createSession } from "@/server/auth";

export async function POST(request: Request) {
  const { email, password, username } = await request.json();

  if (typeof email !== "string" || typeof password !== "string" || typeof username !== "string") {
    return NextResponse.json({ error: "Email, password, and username are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash, username: username.trim() })
    .returning({ id: users.id, email: users.email, username: users.username });

  await createSession(user.id);
  return NextResponse.json({ user });
}
