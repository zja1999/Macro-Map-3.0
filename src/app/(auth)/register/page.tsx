import { RegisterForm } from "@/components/RegisterForm";
import { redirect } from "next/navigation";
import { isEmailPasswordAuthEnabled } from "@/lib/authFeatures";
import { safeRedirectPath } from "@/lib/safeRedirect";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeRedirectPath((await searchParams).next, "");
  if (!isEmailPasswordAuthEnabled()) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return <RegisterForm next={next} />;
}
