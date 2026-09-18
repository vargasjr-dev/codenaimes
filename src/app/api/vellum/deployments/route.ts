import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@data/db";
import { users } from "@data/schema";
import { getCurrentUser } from "@/server/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated", deployments: [] }, { status: 401 });
  }

  const [profile] = await db
    .select({ vellumApiKey: users.vellumApiKey })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!profile?.vellumApiKey) {
    return NextResponse.json(
      { error: "No Vellum API key configured in profile", deployments: [] },
      { status: 200 },
    );
  }

  const vellumResponse = await fetch(
    "https://api.vellum.ai/v1/workflow-deployments?status=ACTIVE&limit=100",
    {
      method: "GET",
      headers: {
        "X-API-KEY": profile.vellumApiKey,
        "Content-Type": "application/json",
      },
    },
  );

  if (!vellumResponse.ok) {
    const errorText = await vellumResponse.text();
    console.error("Vellum API error:", vellumResponse.status, errorText);
    return NextResponse.json(
      { error: "Failed to fetch deployments from Vellum", deployments: [] },
      { status: 200 },
    );
  }

  const vellumData = await vellumResponse.json();

  // Filter deployments that have one STRING input variable named "input"
  const compatibleDeployments = (vellumData.results ?? []).filter((d: {
    input_variables?: Array<{ key: string; type: string }>;
  }) => (d.input_variables ?? []).some((v) => v.key === "input" && v.type === "STRING"));

  const deployments = compatibleDeployments.map((d: {
    id: string;
    name: string;
    label?: string;
    description?: string;
    created?: string;
  }) => ({
    id: d.id,
    name: d.name,
    label: d.label,
    description: d.description,
    created: d.created,
  }));

  return NextResponse.json({ deployments });
}
