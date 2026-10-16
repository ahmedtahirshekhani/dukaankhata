"use client";

import React, { useMemo, useCallback } from "react";
import { ColumnDef } from "@/components/ui/data-table";
import { TableRowActions, TableRowActionItem } from "@/components/ui/table-row-actions";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { maskInvoiceNo, cn } from "@/lib/utils";
import { Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface UseDashboardTableLayoutProps {
  tDash: (key: string) => string;
  tInvoice: (key: string) => string;
  locale: string;
  isPrivacyMode: boolean;
  handleWhatsAppClick: (customer: { name: string; phone: string; balance: number }) => void;
  router: any;
}

export function useDashboardTableLayout({
  tDash,
  tInvoice,
  locale,
  isPrivacyMode,
  handleWhatsAppClick,
  router,
}: UseDashboardTableLayoutProps) {
  const customerColumns = useMemo<ColumnDef<any>[]>(
    () => [
      { id: "name", header: tDash("name") || "Name", accessorKey: "name", sortable: true },
      { id: "email", header: tDash("email") || "Email", accessorKey: "email" },
      { id: "phone", header: tDash("phone") || "Phone", accessorKey: "phone" },
      {
        id: "balance",
        header: tDash("balance") || "Balance",
        cell: (row) =>
          isPrivacyMode
            ? "***"
            : `PKR ${Math.round(row.balance).toLocaleString()}`,
        sortable: true,
      },
      {
        id: "status",
        header: tDash("status") || "Status",
        cell: (row) => <span className="capitalize">{row.status}</span>,
      },
      {
        id: "actions",
        header: <div className="text-right">{tDash("actions") || "Actions"}</div>,
        className: "text-right",
        cell: (row) => {
          const extraActions: TableRowActionItem[] = [
            {
              label: tDash("viewTransactions") || "View Transactions",
              icon: <Receipt className="w-4 h-4" />,
              onClick: () => router.push(`/${locale}/admin/customer-transactions/${row.id}`),
            },
          ];

          if (row.balance > 0) {
            extraActions.push({
              label: tInvoice("sendOnWhatsApp") || "Send Message",
              icon: <WhatsAppIcon className="w-4 h-4 text-green-600" />,
              onClick: () => handleWhatsAppClick(row),
            });
          }

          return (
            <TableRowActions
              canEdit={false}
              canDelete={false}
              extraActions={extraActions}
            />
          );
        },
      },
    ],
    [tDash, locale, isPrivacyMode, router, tInvoice, handleWhatsAppClick]
  );

  const salesColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "invoiceNo",
        header: tDash("invoiceNo") || "Invoice No",
        cell: (row) => (
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-medium">{maskInvoiceNo(row.invoiceNo)}</span>
            <span className="bg-[hsl(var(--soft-gray-bg))] text-[10px] text-muted-foreground px-1.5 py-0.5 rounded">
              {row.invoiceNo}
            </span>
          </div>
        ),
      },
      { id: "customerName", header: tDash("customer") || "Customer", accessorKey: "customerName" },
      {
        id: "total",
        header: tDash("total") || "Total",
        cell: (row) =>
          isPrivacyMode
            ? "***"
            : `PKR ${Math.round(row.total).toLocaleString()}`,
      },
      {
        id: "paid",
        header: tDash("paid") || "Paid",
        cell: (row) =>
          isPrivacyMode
            ? "***"
            : `PKR ${Math.round(row.paid).toLocaleString()}`,
      },
      {
        id: "balance",
        header: tDash("balance") || "Balance",
        cell: (row) =>
          isPrivacyMode
            ? "***"
            : `PKR ${Math.round(row.balance).toLocaleString()}`,
      },
      { id: "date", header: tDash("date") || "Date", accessorKey: "date" },
    ],
    [tDash, isPrivacyMode]
  );

  const itemColumns = useMemo<ColumnDef<any>[]>(
    () => [
      { id: "name", header: tDash("name") || "Name", accessorKey: "name" },
      { id: "category", header: tDash("category") || "Category", accessorKey: "category" },
      { id: "stock", header: tDash("stock") || "Stock", accessorKey: "stock" },
      {
        id: "price",
        header: tDash("price") || "Price",
        cell: (row) =>
          isPrivacyMode
            ? "***"
            : `PKR ${Math.round(row.price).toLocaleString()}`,
      },
    ],
    [tDash, isPrivacyMode]
  );

  // Mobile Render Cards (Fully Internationalized with tDash)
  const renderCustomerMobileCard = useCallback(
    (row: any) => (
      <Card
        onClick={() => router.push(`/${locale}/admin/customer-transactions/${row.id}`)}
        className={cn(
          "p-4 shadow-sm cursor-pointer relative",
          row.balance < 0 && "bg-red-100/70 dark:bg-red-950/50",
          row.balance > 0 && "bg-green-100/70 dark:bg-green-950/50"
        )}
      >
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-base mb-1">{row.name}</h3>
          {row.balance > 0 && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30"
              onClick={(e) => {
                e.stopPropagation();
                handleWhatsAppClick(row);
              }}
            >
              <WhatsAppIcon className="w-4.5 h-4.5" />
              <span className="sr-only">Send on WhatsApp</span>
            </Button>
          )}
        </div>
        <div className="text-sm">
          <p>
            <span className="text-muted-foreground">{tDash("balance") || "Balance"}:</span>{" "}
            {isPrivacyMode ? "***" : `PKR ${Math.round(row.balance).toLocaleString()}`}
          </p>
        </div>
      </Card>
    ),
    [router, locale, isPrivacyMode, handleWhatsAppClick, tDash]
  );

  const renderSalesMobileCard = useCallback(
    (row: any) => (
      <Card className="p-4 shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col items-start gap-0.5">
            <h3 className="font-semibold">{maskInvoiceNo(row.invoiceNo)}</h3>
            <span className="bg-[hsl(var(--soft-gray-bg))] text-[10px] text-muted-foreground px-1.5 py-0.5 rounded">
              {row.invoiceNo}
            </span>
          </div>
          <span className="text-xs text-muted-foreground mt-1">{row.date}</span>
        </div>
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">{tDash("customer") || "Customer"}:</span> {row.customerName}</p>
          <p><span className="text-muted-foreground">{tDash("total") || "Total"}:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.total).toLocaleString()}`}</p>
          <div className="flex justify-between items-center gap-2">
            <p><span className="text-muted-foreground">{tDash("paid") || "Paid"}:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.paid).toLocaleString()}`}</p>
            <p><span className="text-muted-foreground">{tDash("balance") || "Balance"}:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.balance).toLocaleString()}`}</p>
          </div>
        </div>
      </Card>
    ),
    [isPrivacyMode, tDash]
  );

  const renderItemMobileCard = useCallback(
    (row: any) => (
      <Card className="p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2 gap-2">
          <h3 className="font-semibold truncate">{row.name}</h3>
          <span className="text-xs text-muted-foreground shrink-0">{row.category}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <p><span className="text-muted-foreground">{tDash("stock") || "Stock"}:</span> {row.stock}</p>
          <p><span className="text-muted-foreground">{tDash("price") || "Price"}:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.price).toLocaleString()}`}</p>
        </div>
      </Card>
    ),
    [isPrivacyMode, tDash]
  );

  return {
    customerColumns,
    salesColumns,
    itemColumns,
    renderCustomerMobileCard,
    renderSalesMobileCard,
    renderItemMobileCard,
  };
}
