import { moderateContent } from "@/actions/moderation";
import { Card, inputCls } from "./ui";

export function ModerationControls({
  subjectType,
  subjectId,
  hidden = false,
  path,
}: {
  subjectType: "post" | "recipe" | "comment";
  subjectId: string;
  hidden?: boolean;
  path?: string;
}) {
  const canRestore = subjectType !== "comment" && hidden;
  const canHide = subjectType !== "comment" && !hidden;

  return (
    <Card className="space-y-2 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Moderator tools</div>
      <div className="flex flex-wrap items-center gap-2">
        {canHide && (
          <form action={moderateContent}>
            <BaseInputs subjectType={subjectType} subjectId={subjectId} action="hide" path={path} />
            <button className="rounded-lg border border-carbs/40 bg-carbs/10 px-2.5 py-1.5 text-xs font-semibold text-carbs">
              Hide
            </button>
          </form>
        )}
        {canRestore && (
          <form action={moderateContent}>
            <BaseInputs subjectType={subjectType} subjectId={subjectId} action="restore" path={path} />
            <button className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent">
              Restore
            </button>
          </form>
        )}
        <form action={moderateContent}>
          <BaseInputs subjectType={subjectType} subjectId={subjectId} action="delete" path={path} />
          <button className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">
            Delete
          </button>
        </form>
      </div>
      {subjectType !== "comment" && (
        <form action={moderateContent} className="flex flex-wrap items-center gap-2">
          <BaseInputs subjectType={subjectType} subjectId={subjectId} action="warn" path={path} />
          <select name="warningKind" className={`${inputCls} w-auto py-1.5 text-xs`}>
            <option value="misinformation">misinformation</option>
            <option value="unsafe_diet">unsafe diet</option>
            <option value="unverified_macros">unverified macros</option>
          </select>
          <input name="note" maxLength={300} placeholder="Optional note" className={`${inputCls} min-w-40 flex-1 py-1.5 text-xs`} />
          <button className="rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-dim hover:text-ink">
            Add warning
          </button>
        </form>
      )}
    </Card>
  );
}

function BaseInputs({
  subjectType,
  subjectId,
  action,
  path,
}: {
  subjectType: "post" | "recipe" | "comment";
  subjectId: string;
  action: "hide" | "restore" | "delete" | "warn";
  path?: string;
}) {
  return (
    <>
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="action" value={action} />
      {path && <input type="hidden" name="path" value={path} />}
    </>
  );
}
