import { requireServerPermission } from "@/lib/auth/rbac";

export default async function NewQuotationLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("sales.create_quotations", locale, "/admin/sales/quotations");
  return <>{children}</>;
}
