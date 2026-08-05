import { hasModuleAccess } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";

export default async function BankAccountsLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const hasAccess = await hasModuleAccess('payment_methods');
  if (!hasAccess) redirect(`/${locale}/admin`);
  return <>{children}</>;
}
