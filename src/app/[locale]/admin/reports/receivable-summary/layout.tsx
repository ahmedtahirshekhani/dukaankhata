import { requireServerPermission } from "@/lib/auth/rbac";

export default async function ReceivableSummaryLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("reports.view_receivable_summary", locale, "/admin/reports");
  return <>{children}</>;
}
