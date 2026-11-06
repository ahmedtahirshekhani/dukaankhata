import React from "react";
import { ColumnDef } from "@/components/ui/data-table";
import { TableRowActions, TableRowActionItem } from "@/components/ui/table-row-actions";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency, maskInvoiceNo } from "@/lib/utils";
import { formatReadableDate } from "@/lib/date-utils";
import { Eye } from "lucide-react";

export type Order = {
  id: number | string;
  customer_id?: number | string;
  total_amount: number;
  subtotal?: number;
  status: "completed" | "pending" | "cancelled" | string;
  created_at: string;
  updated_at?: string;
  invoice_no?: string;
  sale_date?: string;
  due_date?: string | null;
  customer?: {
    id?: string | number;
    name: string;
    email?: string;
    phone?: string;
    company_name?: string;
    company_address?: string;
    address?: string;
  } | null;
  items?: Array<{
    product_id?: string | number;
    name: string;
    description?: string;
    quantity: number;
    quantity_str?: string;
    quantityType?: "prime" | "damaged";
    price: number;
    discount?: number;
    unit_of_measurement?: string;
    discountType?: "value" | "percentage";
    batch_splits?: any[];
  }>;
  charges?: Array<{
    item: string;
    value: number;
  }>;
  overallDiscount?: number;
  shippingCharges?: number;
  payment?: {
    method: string;
    paid_amount: number;
    paid_date: string;
    no_payment_at_all: boolean;
  } | null;
  customer_notes?: string;
};

export interface UseOrderTableLayoutProps {
  t: (key: string, values?: any) => string;
  tCommon: (key: string, values?: any) => string;
  locale: string;
  router: any;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  setSelectedInvoiceOrder: (order: Order) => void;
  setInvoiceDialogOpen: (open: boolean) => void;
  handleDeleteClick: (order: Order) => void;
}

export function useOrderTableLayout({
  t,
  tCommon,
  locale,
  router,
  canView,
  canEdit,
  canDelete,
  setSelectedInvoiceOrder,
  setInvoiceDialogOpen,
  handleDeleteClick,
}: UseOrderTableLayoutProps) {
  const columns = React.useMemo<ColumnDef<Order>[]>(
    () => [
      {
        id: "date",
        header: t("date") || "Date",
        sortable: true,
        cell: (order) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatReadableDate(order.sale_date || order.created_at)}
          </span>
        ),
      },
      {
        id: "invoice_no",
        header: t("invoiceNo") || "Invoice #",
        accessorKey: "invoice_no",
        sortable: true,
        cell: (order) => (
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-semibold text-foreground text-xs sm:text-sm">
              {maskInvoiceNo(order.invoice_no || `ORD-${order.id}`)}
            </span>
            <span className="bg-muted text-[10px] text-muted-foreground px-1.5 py-0.5 rounded font-mono">
              {order.invoice_no || `ORD-${order.id}`}
            </span>
          </div>
        ),
      },
      {
        id: "customer",
        header: t("customer") || "Customer",
        sortable: true,
        cell: (order) => (
          <div className="flex flex-col items-start max-w-[200px]">
            <span className="font-medium text-foreground text-xs sm:text-sm truncate w-full">
              {order.customer?.name || "-"}
            </span>
            {order.customer?.phone && (
              <span className="text-[11px] text-muted-foreground font-mono">
                {order.customer.phone}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "total_amount",
        header: <div className="text-right">{t("total") || "Total"}</div>,
        accessorKey: "total_amount",
        sortable: true,
        className: "text-right",
        cell: (order) => (
          <span className="font-semibold text-foreground text-xs sm:text-sm">
            {formatCurrency(order.total_amount || 0)}
          </span>
        ),
      },
      {
        id: "paid",
        header: <div className="text-right">{t("paid") || "Received"}</div>,
        className: "text-right",
        cell: (order) => {
          const paid =
            order.payment && !order.payment.no_payment_at_all
              ? order.payment.paid_amount || 0
              : 0;
          return (
            <span className="font-medium text-xs sm:text-sm">
              {formatCurrency(paid)}
            </span>
          );
        },
      },
      {
        id: "balance",
        header: <div className="text-right">{t("balance") || "Balance"}</div>,
        sortable: true,
        className: "text-right",
        cell: (order) => {
          const paid =
            order.payment && !order.payment.no_payment_at_all
              ? order.payment.paid_amount || 0
              : 0;
          const balance = (order.total_amount || 0) - paid;
          return (
            <span
              className={cn(
                "font-semibold text-xs sm:text-sm"
              )}
            >
              {formatCurrency(balance)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: <div className="text-right">{tCommon("actions")}</div>,
        className: "text-right",
        cell: (order) => {
          const extraActions: TableRowActionItem[] = [];

          if (canView) {
            extraActions.push({
              label: t("showInvoice"),
              icon: <Eye className="w-4 h-4" />,
              onClick: () => {
                setSelectedInvoiceOrder(order);
                setInvoiceDialogOpen(true);
              },
            });
          }

          return (
            <TableRowActions
              align="right"
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() =>
                router.push(`/${locale}/admin/sales/invoice/new?edit=${order.id}`)
              }
              onDelete={() => handleDeleteClick(order)}
              extraActions={extraActions}
            />
          );
        },
      },
    ],
    [
      t,
      tCommon,
      locale,
      router,
      canView,
      canEdit,
      canDelete,
      setSelectedInvoiceOrder,
      setInvoiceDialogOpen,
      handleDeleteClick,
    ]
  );

  const renderMobileCard = React.useCallback(
    (order: Order) => {
      const paid =
        order.payment && !order.payment.no_payment_at_all
          ? order.payment.paid_amount || 0
          : 0;
      const balance = (order.total_amount || 0) - paid;

      return (
        <Card className="p-3.5 shadow-sm border border-border bg-card">
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div className="flex flex-col items-start gap-0.5 min-w-0">
                <span className="text-[11px] text-muted-foreground">
                  {t("invoiceNo") || "Invoice #"}
                </span>
                <h3 className="font-semibold text-sm truncate">
                  {maskInvoiceNo(order.invoice_no || `ORD-${order.id}`)}
                </h3>
                <span className="bg-muted text-[10px] text-muted-foreground px-1.5 py-0.5 rounded font-mono mt-0.5">
                  {order.invoice_no || `ORD-${order.id}`}
                </span>
              </div>

              <div className="flex gap-1 flex-shrink-0 bg-background/50 rounded-md">
                {columns.find((c) => c.id === "actions")?.cell?.(order, 0)}
              </div>
            </div>

            <div className="pt-2 border-t border-border space-y-2 text-xs">
              <div className="flex justify-between items-center gap-2">
                <p className="font-medium text-foreground truncate min-w-0">
                  <span className="text-muted-foreground">{t("customer") || "Party"}:</span>{" "}
                  <span className="font-semibold">{order.customer?.name || "-"}</span>
                </p>
                <p className="text-muted-foreground text-xs whitespace-nowrap shrink-0">
                  {formatReadableDate(order.sale_date || order.created_at)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                <div className="bg-muted/40 p-2 rounded text-center">
                  <span className="text-[10px] text-muted-foreground block">{t("total") || "Total"}</span>
                  <p className="font-semibold text-xs text-foreground mt-0.5">
                    {formatCurrency(order.total_amount || 0)}
                  </p>
                </div>
                <div className="bg-muted/40 p-2 rounded text-center">
                  <span className="text-[10px] text-muted-foreground block">{t("paid") || "Received"}</span>
                  <p className="font-semibold text-xs mt-0.5">
                    {formatCurrency(paid)}
                  </p>
                </div>
                <div className="bg-muted/40 p-2 rounded text-center">
                  <span className="text-[10px] text-muted-foreground block">
                    {t("balance") || "Balance"}
                  </span>
                  <p
                    className={cn(
                      "font-semibold text-xs mt-0.5",
                    )}
                  >
                    {formatCurrency(balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      );
    },
    [columns, t]
  );

  return { columns, renderMobileCard };
}
