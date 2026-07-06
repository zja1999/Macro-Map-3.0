import { moderateGroupPost } from "@/actions/groups";

/** Post controls for a group's owner/moderators — remove, restore, or delete a
 * post inside their own group. Narrower than the platform ModerationControls:
 * no content-warning labels (those stay platform-level). */
export function GroupPostModeration({
  postId,
  groupId,
  slug,
  hidden = false,
}: {
  postId: string;
  groupId: string;
  slug: string;
  hidden?: boolean;
}) {
  const base = (action: string) => (
    <>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="action" value={action} />
    </>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface px-2.5 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Group tools</span>
      {hidden ? (
        <form action={moderateGroupPost}>
          {base("restore")}
          <button className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
            Restore
          </button>
        </form>
      ) : (
        <form action={moderateGroupPost}>
          {base("hide")}
          <button className="rounded-lg border border-carbs/40 bg-carbs/10 px-2.5 py-1 text-xs font-semibold text-carbs">
            Remove
          </button>
        </form>
      )}
      <form action={moderateGroupPost}>
        {base("delete")}
        <button className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
          Delete
        </button>
      </form>
    </div>
  );
}
