import { requireServerPermission } from "@/lib/auth/rbac";

export default async function NewInvoiceLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("sales.create_invoice", locale, "/admin/sales/invoice");
  return <>{children}</>;
}
