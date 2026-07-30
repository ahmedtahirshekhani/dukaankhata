import { hasModuleAccess } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";

export default async function SalesLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Ensures the user has at least one permission starting with 'sales.'
  const hasAccess = await hasModuleAccess('sales');
  if (!hasAccess) redirect(`/${locale}/admin`);
  
  return <>{children}</>;
}
