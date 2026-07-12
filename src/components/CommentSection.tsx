import { getComments } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { timeAgo } from "@/lib/utils";
import { Avatar } from "./ui";
import Link from "next/link";
import { ModerationControls } from "./ModerationControls";
import { ReportButton } from "./ReportButton";
import { CommentForm } from "./CommentForm";
import { UserBadges } from "./UserBadges";

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
        {rows.map(({ comment, username, displayName, avatarUrl, badges }) => (
          <div key={comment.id} className="flex gap-2.5">
            <Link href={`/u/${username}`}>
              <Avatar name={displayName} size={30} src={avatarUrl} />
            </Link>
            <div className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2">
              <div className="flex items-baseline gap-2">
                <Link href={`/u/${username}`} className="text-xs font-semibold hover:text-accent">
                  {displayName}
                </Link>
                <UserBadges badges={badges} size={16} />
                <span className="text-[10px] text-ink-faint">{timeAgo(comment.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-dim">{comment.body}</p>
              {user && user.id !== comment.authorId && (
                <div className="mt-1.5">
                  <ReportButton subjectType="comment" subjectId={comment.id} />
                </div>
              )}
              {canModerate && (
                <div className="mt-2">
                  <ModerationControls subjectType="comment" subjectId={comment.id} path={`/${subjectType === "post" ? "posts" : "recipes"}/${subjectId}`} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <CommentForm subjectType={subjectType} subjectId={subjectId} />
    </div>
  );
}
