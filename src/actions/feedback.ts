"use server";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { feedback } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  body: z.string().min(5).max(2000),
  pageContext: z.string().max(200).optional(),
});

export async function submitFeedback(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  const parsed = schema.safeParse({
    body: formData.get("body"),
    pageContext: formData.get("pageContext") || undefined,
  });
  if (!parsed.success) return { error: "Tell us a bit more (at least 5 characters)." };

  // rate limit: one submission per 2 minutes per user
  if (user) {
    const [last] = await db
      .select({ createdAt: feedback.createdAt })
      .from(feedback)
      .where(eq(feedback.userId, user.id))
      .orderBy(desc(feedback.createdAt))
      .limit(1);
    if (last && Date.now() - last.createdAt.getTime() < 120_000) {
      return { error: "You just sent feedback — give it a couple of minutes." };
    }
  }

  await db.insert(feedback).values({
    userId: user?.id ?? null,
    body: parsed.data.body,
    pageContext: parsed.data.pageContext ?? null,
  });
  return { ok: true };
}
