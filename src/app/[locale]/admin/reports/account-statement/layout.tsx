import { requireServerPermission } from "@/lib/auth/rbac";

export default async function AccountStatementLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("reports.view_account_statement", locale, "/admin/reports");
  return <>{children}</>;
}
