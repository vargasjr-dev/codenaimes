import { NextResponse } from "next/server";
import { db } from "@data/db";
import { users } from "@data/schema";
import { createSession, getCurrentUser } from "@/server/auth";

export async function POST(request: Request) {
  const existing = await getCurrentUser();
  if (existing) {
    return NextResponse.json({ user: existing });
  }

  const { name } = await request.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const [user] = await db
    .insert(users)
    .values({ username: name.trim().slice(0, 40), isGuest: true })
    .returning({ id: users.id, email: users.email, username: users.username, isGuest: users.isGuest });

  await createSession(user.id);
  return NextResponse.json({ user });
}
