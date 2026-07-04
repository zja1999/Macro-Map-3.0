import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { posts, profiles, recipes, reactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { PostCard } from "@/components/PostCard";
import { CommentSection } from "@/components/CommentSection";
import { deletePost } from "@/actions/social";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
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

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PostCard
        item={{
          post: row.post,
          author: { username: row.username, displayName: row.displayName, goal: row.goal },
          recipe,
          myReaction: myReaction?.kind ?? null,
        }}
      />
      {row.post.authorId === user.id && (
        <form action={deletePost} className="text-right">
          <input type="hidden" name="postId" value={row.post.id} />
          <button className="text-xs text-ink-faint hover:text-danger">Delete post</button>
        </form>
      )}
      <CommentSection subjectType="post" subjectId={row.post.id} />
    </div>
  );
}
