import { requireServerPermission } from "@/lib/auth/rbac";

export default async function ProfitabilityLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("reports.view_profitability", locale, "/admin/reports");
  return <>{children}</>;
}
