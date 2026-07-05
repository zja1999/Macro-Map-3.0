import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contentWarnings, posts, profiles, recipes, reactions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { PostCard } from "@/components/PostCard";
import { CommentSection } from "@/components/CommentSection";
import { ReportButton } from "@/components/ReportButton";
import { deletePost } from "@/actions/social";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [row] = await db
    .select({ post: posts, username: profiles.username, displayName: profiles.displayName, goal: profiles.goal })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(eq(posts.id, id))
    .limit(1);
  if (!row) notFound();

  let recipe = null;
  if (row.post.refType === "recipe" && row.post.refId) {
    const [r] = await db.select().from(recipes).where(eq(recipes.id, row.post.refId)).limit(1);
    recipe = r ?? null;
  }
  const [myReaction] = await db
    .select()
    .from(reactions)
    .where(and(eq(reactions.userId, user.id), eq(reactions.subjectType, "post"), eq(reactions.subjectId, id)));
  const warnings = await db
    .select()
    .from(contentWarnings)
    .where(and(eq(contentWarnings.subjectType, "post"), eq(contentWarnings.subjectId, id)));

  // moderated content: author sees a notice, everyone else gets a 404 (docs/07 §2)
  if (row.post.isRemoved && row.post.authorId !== user.id && user.role === "user") notFound();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {row.post.isRemoved && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger">
          This post is hidden pending moderation review. Only you (and moderators) can see it.
        </p>
      )}
      {warnings.map((w) => (
        <p key={w.kind} className="rounded-xl border border-carbs/40 bg-carbs/10 px-4 py-3 text-xs text-carbs">
          ⚠ Community warning: {w.kind.replace(/_/g, " ")}
          {w.note && ` — ${w.note}`}
        </p>
      ))}
      <PostCard
        item={{
          post: row.post,
          author: { username: row.username, displayName: row.displayName, goal: row.goal },
          recipe,
          myReaction: myReaction?.kind ?? null,
        }}
      />
      <div className="flex items-center justify-between">
        {row.post.authorId !== user.id ? (
          <ReportButton subjectType="post" subjectId={row.post.id} />
        ) : (
          <span />
        )}
        {row.post.authorId === user.id && (
          <form action={deletePost}>
            <input type="hidden" name="postId" value={row.post.id} />
            <button className="text-xs text-ink-faint hover:text-danger">Delete post</button>
          </form>
        )}
      </div>
      <CommentSection subjectType="post" subjectId={row.post.id} />
    </div>
  );
}
