import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProgressPhotos } from "@/lib/queries";
import { formatDateLabel, todayStr } from "@/lib/utils";
import { ProgressPhotoForm } from "@/components/ProgressForms";
import { Card, EmptyState, btnGhost } from "@/components/ui";

export const metadata = { title: "Progress photos" };

export default async function ProgressPhotosPage() {
  const user = await requireUser();
  const today = todayStr();
  const photos = await getProgressPhotos(user.id);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold">Progress photos</h1>
          <p className="text-xs text-ink-faint">Attach and review your private visual progress.</p>
        </div>
        <Link href="/progress" className={`${btnGhost} shrink-0`}>
          All progress
        </Link>
      </div>

      <Card className="p-4">
        <ProgressPhotoForm today={today} />
      </Card>

      {photos.length > 0 ? (
        <Card className="p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Photo history</h2>
            <span className="text-[10px] text-ink-faint">{photos.length} attached</span>
          </div>
          <ul className="divide-y divide-edge">
            {photos.map(({ photo, entryDate }) => (
              <li key={photo.id} className="flex min-w-0 items-center justify-between gap-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium">{photo.storageKey}</div>
                  <div className="text-[10px] text-ink-faint">
                    {formatDateLabel(entryDate)} · {photo.mimeType}
                    {photo.width && photo.height ? ` · ${photo.width}x${photo.height}` : ""}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                  private
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="No progress photos yet" hint="Attached photos will stay private and appear here." />
      )}

      <p className="text-center text-[10px] text-ink-faint">Progress photos are private by default.</p>
    </div>
  );
}
