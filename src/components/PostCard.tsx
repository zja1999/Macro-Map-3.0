import Link from "next/link";
import { toggleReaction } from "@/actions/social";
import { timeAgo, REACTION_KINDS } from "@/lib/utils";
import type { FeedPost } from "@/lib/queries";
import { Card, UserChip, Badge } from "./ui";
import { RecipeCard } from "./RecipeCard";
import { ModerationControls } from "./ModerationControls";
import { GroupPostModeration } from "./GroupPostModeration";

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
  groupModeration,
}: {
  item: FeedPost;
  authorForRecipe?: { displayName: string; username: string };
  canModerate?: boolean;
  moderationPath?: string;
  // set on group feeds when the viewer is the group's owner/moderator (but not a
  // platform moderator, who gets the fuller ModerationControls instead)
  groupModeration?: { groupId: string; slug: string };
}) {
  const { post, author, recipe, myReaction } = item;
  const reactionSummary = item.reactionSummary
    .map((summary) => ({
      ...summary,
      meta: REACTION_KINDS.find((r) => r.kind === summary.kind),
    }))
    .filter((summary) => summary.count > 0)
    .sort((a, b) => REACTION_KINDS.findIndex((r) => r.kind === a.kind) - REACTION_KINDS.findIndex((r) => r.kind === b.kind));
  const showRemovedNote = post.isRemoved && (canModerate || !!groupModeration);
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <UserChip username={author.username} displayName={author.displayName} sub={timeAgo(post.createdAt)} />
        {TYPE_BADGES[post.type] && <Badge>{TYPE_BADGES[post.type]}</Badge>}
      </div>

      {showRemovedNote && (
        <p className="rounded-md border border-carbs/40 bg-carbs/10 px-2.5 py-1 text-[11px] font-medium text-carbs">
          Removed — only visible to moderators.
        </p>
      )}

      {post.body && <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{post.body}</p>}

      {recipe && (
        <RecipeCard
          recipe={recipe}
          authorName={authorForRecipe?.displayName ?? author.displayName}
          authorUsername={authorForRecipe?.username ?? author.username}
          compact
        />
      )}

      {canModerate ? (
        <ModerationControls subjectType="post" subjectId={post.id} hidden={post.isRemoved} path={moderationPath ?? `/posts/${post.id}`} />
      ) : groupModeration ? (
        <GroupPostModeration postId={post.id} groupId={groupModeration.groupId} slug={groupModeration.slug} hidden={post.isRemoved} />
      ) : null}

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
          {reactionSummary.length > 0 && (
            <div className="ml-2 flex items-center gap-1">
              {reactionSummary.map((r) => (
                <span key={r.kind} title={r.meta?.label ?? r.kind} className="rounded-full bg-surface px-1.5 py-0.5 text-[11px] tabular-nums text-ink-dim">
                  {r.meta?.emoji ?? "•"} {r.count}
                </span>
              ))}
            </div>
          )}
        </div>
        <Link href={`/posts/${post.id}`} className="text-xs font-medium text-ink-faint hover:text-accent">
          💬 {post.commentCount > 0 ? post.commentCount : "Comment"}
        </Link>
      </div>
    </Card>
  );
}
