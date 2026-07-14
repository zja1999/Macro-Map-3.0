import { asc, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawQuery = new URL(request.url).searchParams.get("q")?.trim().replace(/^@/, "").toLowerCase() ?? "";
  if (rawQuery.length < 2 || rawQuery.length > 24 || !/^[a-z0-9_]+$/.test(rawQuery)) {
    return NextResponse.json({ users: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const matches = await db
    .select({
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      goal: profiles.goal,
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(
      sql`${isNull(users.bannedAt)} and ${eq(profiles.visibility, "public")} and left(lower(${profiles.username}), ${rawQuery.length}) = ${rawQuery}`,
    )
    .orderBy(asc(profiles.username))
    .limit(8);

  return NextResponse.json({ users: matches }, { headers: { "Cache-Control": "private, no-store" } });
}
