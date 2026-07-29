import { hasModuleAccess } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";

export default async function AIChatLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const hasAccess = await hasModuleAccess('ai_chat');
  if (!hasAccess) redirect(`/${locale}/admin`);
  return <>{children}</>;
}
