import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups, notificationBroadcasts, profiles } from "@/db/schema";
import { sendAdminNotification, updateWelcomeNotification } from "@/actions/adminNotifications";
import { requireAdmin } from "@/lib/permissions";
import { getWelcomeNotificationSettings } from "@/lib/welcomeNotification";
import { timeAgo } from "@/lib/utils";
import { AdminNav } from "@/components/AdminNav";
import { Card, inputCls } from "@/components/ui";

export const metadata = { title: "Admin - Notifications" };

export default async function AdminNotificationsPage() {
  await requireAdmin();
  const [welcome, groupRows, history] = await Promise.all([
    getWelcomeNotificationSettings(),
    db.select({ id: groups.id, name: groups.name }).from(groups).orderBy(groups.name),
    db
      .select({ broadcast: notificationBroadcasts, senderName: profiles.displayName })
      .from(notificationBroadcasts)
      .innerJoin(profiles, eq(profiles.userId, notificationBroadcasts.sentBy))
      .orderBy(desc(notificationBroadcasts.createdAt))
      .limit(20),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-lg font-bold">Admin notifications</h1>
        <p className="text-sm text-ink-dim">Configure the account welcome and send inbox/push messages to one user, a group, or the full site.</p>
      </div>
      <AdminNav isAdmin />

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Account welcome</h2>
        <form action={updateWelcomeNotification} className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={welcome.enabled} /> Enabled for new accounts</label>
          <label className="block space-y-1 text-xs text-ink-dim">Title<input name="title" required maxLength={80} defaultValue={welcome.title} className={inputCls} /></label>
          <label className="block space-y-1 text-xs text-ink-dim">Message<textarea name="message" required maxLength={1000} rows={3} defaultValue={welcome.message} className={`${inputCls} resize-none`} /></label>
          <label className="block space-y-1 text-xs text-ink-dim">Open path<input name="href" required maxLength={300} defaultValue={welcome.href} className={inputCls} /></label>
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">Save welcome</button>
        </form>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Send a notification</h2>
        <form action={sendAdminNotification} className="space-y-3">
          <label className="block space-y-1 text-xs text-ink-dim">Audience
            <select name="targetType" className={inputCls} defaultValue="user">
              <option value="user">One user</option><option value="group">A group</option><option value="site">Everyone</option>
            </select>
          </label>
          <label className="block space-y-1 text-xs text-ink-dim">User (used for one-user audience)<input name="targetUser" maxLength={120} placeholder="username or email" className={inputCls} /></label>
          <label className="block space-y-1 text-xs text-ink-dim">Group (used for group audience)
            <select name="targetGroup" className={inputCls} defaultValue=""><option value="">Choose a group</option>{groupRows.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          </label>
          <label className="block space-y-1 text-xs text-ink-dim">Title<input name="title" required maxLength={80} className={inputCls} /></label>
          <label className="block space-y-1 text-xs text-ink-dim">Message<textarea name="message" required maxLength={1000} rows={3} className={`${inputCls} resize-none`} /></label>
          <label className="block space-y-1 text-xs text-ink-dim">Open path<input name="href" required maxLength={300} defaultValue="/notifications" className={inputCls} /></label>
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">Send notification</button>
        </form>
      </Card>

      <div className="space-y-2">
        <h2 className="font-semibold">Recent sends</h2>
        {history.length === 0 ? <Card className="p-6 text-center text-sm text-ink-faint">No admin notifications sent yet.</Card> : history.map(({ broadcast, senderName }) => (
          <Card key={broadcast.id} className="p-3 text-sm">
            <div className="font-medium">{broadcast.title}</div>
            <div className="text-ink-dim">{broadcast.message}</div>
            <div className="mt-1 text-xs text-ink-faint">{broadcast.targetType} · {broadcast.recipientCount} recipients · {senderName} · {timeAgo(broadcast.createdAt)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
