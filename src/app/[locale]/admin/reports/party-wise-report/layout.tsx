import { requireServerPermission } from "@/lib/auth/rbac";

export default async function PartyWiseReportLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("reports.view_party_wise_sale_purchase_report", locale, "/admin/reports");
  return <>{children}</>;
}
