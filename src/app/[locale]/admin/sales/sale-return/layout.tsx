import { requireServerPermission } from "@/lib/auth/rbac";

export default async function SaleReturnLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("sales.view_sale_return", locale, "/admin/sales");
  return <>{children}</>;
}
