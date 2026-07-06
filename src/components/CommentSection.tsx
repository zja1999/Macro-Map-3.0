import { addComment } from "@/actions/social";
import { getComments } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { timeAgo } from "@/lib/utils";
import { Avatar, inputCls, btnPrimary } from "./ui";
import Link from "next/link";
import { ModerationControls } from "./ModerationControls";

export async function CommentSection({
  subjectType,
  subjectId,
}: {
  subjectType: "post" | "recipe";
  subjectId: string;
}) {
  const [rows, user] = await Promise.all([getComments(subjectType, subjectId), getCurrentUser()]);
  const canModerate = !!user && isModerator(user);
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-ink-dim">
        {rows.length} comment{rows.length === 1 ? "" : "s"}
      </h3>
      <div className="space-y-3">
        {rows.map(({ comment, username, displayName, avatarUrl }) => (
          <div key={comment.id} className="flex gap-2.5">
            <Link href={`/u/${username}`}>
              <Avatar name={displayName} size={30} src={avatarUrl} />
            </Link>
            <div className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2">
              <div className="flex items-baseline gap-2">
                <Link href={`/u/${username}`} className="text-xs font-semibold hover:text-accent">
                  {displayName}
                </Link>
                <span className="text-[10px] text-ink-faint">{timeAgo(comment.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-dim">{comment.body}</p>
              {canModerate && (
                <div className="mt-2">
                  <ModerationControls subjectType="comment" subjectId={comment.id} path={`/${subjectType === "post" ? "posts" : "recipes"}/${subjectId}`} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <form action={addComment} className="flex gap-2">
        <input type="hidden" name="subjectType" value={subjectType} />
        <input type="hidden" name="subjectId" value={subjectId} />
        <input name="body" required maxLength={1000} placeholder="Add a comment…" className={inputCls} />
        <button className={btnPrimary}>Post</button>
      </form>
    </div>
  );
}
