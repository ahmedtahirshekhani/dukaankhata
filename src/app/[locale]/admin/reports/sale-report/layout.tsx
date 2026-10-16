import { requireServerPermission } from "@/lib/auth/rbac";

export default async function SaleReportLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("reports.view_sale_report", locale, "/admin/reports");
  return <>{children}</>;
}
