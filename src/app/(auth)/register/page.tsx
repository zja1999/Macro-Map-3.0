import { RegisterForm } from "@/components/RegisterForm";
import { safeRedirectPath } from "@/lib/safeRedirect";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeRedirectPath((await searchParams).next, "");
  return <RegisterForm next={next} />;
}
