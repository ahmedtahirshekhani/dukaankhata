import { requireServerPermission } from "@/lib/auth/rbac";

export default async function PurchaseReportLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("reports.view_purchase_report", locale, "/admin/reports");
  return <>{children}</>;
}
