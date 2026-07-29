import { hasModuleAccess } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";

export default async function StaffLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const hasAccess = await hasModuleAccess('staff');
  if (!hasAccess) redirect(`/${locale}/admin`);
  return <>{children}</>;
}
