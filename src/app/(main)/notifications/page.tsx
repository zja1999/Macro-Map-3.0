import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { Avatar, Card, EmptyState, btnGhost } from "@/components/ui";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await getNotifications(user.id);
  const unread = rows.filter((r) => !r.notification.readAt).length;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Notifications</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button className={btnGhost}>Mark all read</button>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No notifications yet" hint="Follows, comments, reactions, and group posts will show up here." />
      ) : (
        <div className="space-y-2">
          {rows.map(({ notification, actorDisplayName, actorUsername }) => (
            <Card key={notification.id} className={`p-3 ${notification.readAt ? "" : "border-accent/40 bg-accent/5"}`}>
              <div className="flex items-center gap-3">
                <Avatar name={actorDisplayName} />
                <Link href={notification.href} className="min-w-0 flex-1 hover:text-accent">
                  <div className="truncate text-sm font-medium">{notification.message}</div>
                  <div className="truncate text-xs text-ink-faint">
                    @{actorUsername} · {timeAgo(notification.createdAt)}
                  </div>
                </Link>
                {!notification.readAt && (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button className="rounded-full border border-accent/40 px-2 py-1 text-[10px] font-semibold text-accent">
                      Read
                    </button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
