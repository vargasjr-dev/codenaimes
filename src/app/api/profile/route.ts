import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { users } from "@data/schema";
import { getCurrentUser } from "@/server/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [profile] = await db
    .select({ vellumApiKey: users.vellumApiKey, username: users.username })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.vellumApiKey !== "string") {
    return NextResponse.json({ error: "vellumApiKey is required" }, { status: 400 });
  }

  await db
    .update(users)
    .set({ vellumApiKey: body.vellumApiKey, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return NextResponse.json({ success: true });
}
