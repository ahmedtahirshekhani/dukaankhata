import { hasModuleAccess } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";

export default async function CustomerTransactionsLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const hasSales = await hasModuleAccess('sales');
  const hasPurchase = await hasModuleAccess('purchase');
  
  if (!hasSales && !hasPurchase) {
    redirect(`/${locale}/admin`);
  }
  
  return <>{children}</>;
}
