import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import type { FeedPost } from "@/lib/queries";
import { Card, UserChip, Badge } from "./ui";
import { ReactionBar } from "./ReactionBar";
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
  openable = true,
}: {
  item: FeedPost;
  authorForRecipe?: { displayName: string; username: string };
  canModerate?: boolean;
  moderationPath?: string;
  // set on group feeds when the viewer is the group's owner/moderator (but not a
  // platform moderator, who gets the fuller ModerationControls instead)
  groupModeration?: { groupId: string; slug: string };
  // links the post open to its detail page (where reporting + comments live);
  // false on the detail page itself, which already *is* the post
  openable?: boolean;
}) {
  const { post, author, recipe, myReaction } = item;
  const showRemovedNote = post.isRemoved && (canModerate || !!groupModeration);
  return (
    <Card className="min-w-0 space-y-3 overflow-hidden p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <UserChip username={author.username} displayName={author.displayName} sub={timeAgo(post.createdAt)} avatarUrl={author.avatarUrl} />
        {TYPE_BADGES[post.type] && <Badge>{TYPE_BADGES[post.type]}</Badge>}
      </div>

      {showRemovedNote && (
        <p className="rounded-md border border-carbs/40 bg-carbs/10 px-2.5 py-1 text-[11px] font-medium text-carbs">
          Removed — only visible to moderators.
        </p>
      )}

      {post.body &&
        (openable ? (
          <Link href={`/posts/${post.id}`} className="block min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed text-ink hover:text-accent">
            {post.body}
          </Link>
        ) : (
          <p className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed text-ink">{post.body}</p>
        ))}

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
        <ReactionBar
          postId={post.id}
          myReaction={myReaction}
          summary={item.reactionSummary.map(({ kind, count }) => ({ kind, count }))}
        />
        <div className="flex shrink-0 items-center gap-3">
          <Link href={`/posts/${post.id}`} className="text-xs font-medium text-ink-faint hover:text-accent">
            💬 {post.commentCount > 0 ? post.commentCount : "Comment"}
          </Link>
        </div>
      </div>
    </Card>
  );
}
