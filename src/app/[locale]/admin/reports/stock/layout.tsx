import { requireServerPermission } from "@/lib/auth/rbac";

export default async function StockReportLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("reports.view_stock", locale, "/admin/reports");
  return <>{children}</>;
}
