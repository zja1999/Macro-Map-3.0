import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function MePage() {
  const user = (await getCurrentUser())!;
  redirect(`/u/${user.profile.username}`);
}
