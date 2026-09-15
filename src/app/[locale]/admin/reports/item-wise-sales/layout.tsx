import { requireServerPermission } from "@/lib/auth/rbac";

export default async function ItemWiseSalesLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  await requireServerPermission("reports.view_item_wise_sales", locale, "/admin/reports");
  return <>{children}</>;
}

