import { requireServerPermission } from "@/lib/auth/rbac";

export default async function EditQuotationLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("sales.edit_quotations", locale, "/admin/sales/quotations");
  return <>{children}</>;
}
