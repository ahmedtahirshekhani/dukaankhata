import { requireServerPermission } from "@/lib/auth/rbac";

export default async function InvoiceLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("sales.view_invoice", locale, "/admin/sales");
  return <>{children}</>;
}
