import { LoginForm } from "@/components/LoginForm";
import { safeRedirectPath } from "@/lib/safeRedirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeRedirectPath((await searchParams).next, "");
  return <LoginForm next={next} />;
}
