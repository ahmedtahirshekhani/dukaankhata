import { requireServerPermission } from "@/lib/auth/rbac";

export default async function PaymentInLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("sales.view_payment_in", locale, "/admin/sales");
  return <>{children}</>;
}
