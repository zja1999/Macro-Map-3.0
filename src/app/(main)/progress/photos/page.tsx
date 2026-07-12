import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProgressPhotos } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { ProgressPhotosExperience } from "@/components/ProgressPhotosExperience";
import { btnGhost } from "@/components/ui";

export const metadata = { title: "Progress photos" };

export default async function ProgressPhotosPage() {
  const user = await requireUser();
  const groups = await getProgressPhotos(user.id, 200);
  return <div className="mx-auto max-w-3xl space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><h1 className="text-base font-bold">Progress photos</h1><p className="text-xs text-ink-faint">Private · authenticated access only</p></div>
      <Link href="/progress" className={`${btnGhost} shrink-0`}>All progress</Link>
    </div>
    <ProgressPhotosExperience groups={groups} today={todayStr()} />
  </div>;
}
