import { requireServerPermission } from "@/lib/auth/rbac";

export default async function QuotationsLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("sales.view_quotations", locale, "/admin/sales");
  return <>{children}</>;
}
