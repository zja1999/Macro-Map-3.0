import Link from "next/link";
import { toggleReaction } from "@/actions/social";
import { timeAgo, REACTION_KINDS } from "@/lib/utils";
import type { FeedPost } from "@/lib/queries";
import { Card, UserChip, Badge } from "./ui";
import { RecipeCard } from "./RecipeCard";
import { ModerationControls } from "./ModerationControls";

const TYPE_BADGES: Record<string, string> = {
  recipe: "🍳 recipe",
  tip: "💡 tip",
  question: "❓ question",
  progress: "📈 progress",
  personal_record: "🏆 PR",
  meal_log_highlight: "🍽️ meal log",
};

export function PostCard({
  item,
  authorForRecipe,
  canModerate = false,
  moderationPath,
}: {
  item: FeedPost;
  authorForRecipe?: { displayName: string; username: string };
  canModerate?: boolean;
  moderationPath?: string;
}) {
  const { post, author, recipe, myReaction } = item;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <UserChip username={author.username} displayName={author.displayName} sub={timeAgo(post.createdAt)} />
        {TYPE_BADGES[post.type] && <Badge>{TYPE_BADGES[post.type]}</Badge>}
      </div>

      {post.body && <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{post.body}</p>}

      {recipe && (
        <RecipeCard
          recipe={recipe}
          authorName={authorForRecipe?.displayName ?? author.displayName}
          authorUsername={authorForRecipe?.username ?? author.username}
          compact
        />
      )}

      {canModerate && (
        <ModerationControls subjectType="post" subjectId={post.id} hidden={post.isRemoved} path={moderationPath ?? `/posts/${post.id}`} />
      )}

      <div className="flex items-center justify-between border-t border-edge pt-2">
        <div className="flex items-center gap-0.5">
          {REACTION_KINDS.map((r) => (
            <form key={r.kind} action={toggleReaction}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="kind" value={r.kind} />
              <button
                title={r.label}
                className={`rounded-md px-1.5 py-1 text-sm transition hover:bg-surface ${
                  myReaction === r.kind ? "bg-accent/15 ring-1 ring-accent/40" : "opacity-60 hover:opacity-100"
                }`}
              >
                {r.emoji}
              </button>
            </form>
          ))}
          {post.reactionCount > 0 && (
            <span className="ml-1 text-xs tabular-nums text-ink-faint">{post.reactionCount}</span>
          )}
        </div>
        <Link href={`/posts/${post.id}`} className="text-xs font-medium text-ink-faint hover:text-accent">
          💬 {post.commentCount > 0 ? post.commentCount : "Comment"}
        </Link>
      </div>
    </Card>
  );
}
