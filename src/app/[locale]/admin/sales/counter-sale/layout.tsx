import { requireServerPermission } from "@/lib/auth/rbac";

export default async function CounterSaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("sales.view_counter_sale", locale, "/admin/sales");
  return <>{children}</>;
}
