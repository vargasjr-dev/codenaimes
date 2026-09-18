import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { users } from "@data/schema";
import { createSession } from "@/server/auth";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({
    user: { id: user.id, email: user.email, username: user.username },
  });
}
