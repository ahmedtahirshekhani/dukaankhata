"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  PlusCircle,
  ArrowUpDown,
  FilterIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeDate } from "@/lib/date-utils";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { useOfflineOrders } from "@/lib/hooks/useOfflineData";
import { updateOfflinePartyBalance } from "@/lib/ledger/offline-ledger";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";

// Reusable Components & Layout
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { useTableState } from "@/lib/hooks/use-table-state";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { InvoicePreviewDialog } from "@/components/invoice/invoice-preview-dialog";
import { useOrderTableLayout, type Order } from "./order-table-layout";

export default function OrdersPage() {
  const t = useTranslations("orders");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const { can } = usePermissions();
  const canView = can("sales", "view_invoice") || can("sales", "view");
  const canCreate = can("sales", "create_invoice") || can("sales", "create");
  const canEdit = can("sales", "edit_invoice") || can("sales", "edit");
  const canDelete = can("sales", "delete_invoice") || can("sales", "delete");

  // State Management
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending" | "cancelled">("all");
  const [sortBy, setSortBy] = useState<"default" | "totalHighToLow" | "balanceHighToLow">("default");

  // Dialogs State
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title?: string; message: string }>({
    open: false,
    message: "",
  });

  // Table State
  const tableState = useTableState<Order>({
    defaultPageSize: 10,
    searchFields: [], // useOfflineOrders filters at the IndexedDB level
  });

  // Fetch reactive offline orders
  const offlineOrders = useOfflineOrders(tableState.debouncedSearchTerm, statusFilter) as Order[] | undefined;
  const isDexieLoading = offlineOrders === undefined;

  // Track initial sync readiness
  const [isSyncReady, setIsSyncReady] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem("last_sync_timestamp")
  );

  useEffect(() => {
    const handleSyncComplete = () => setIsSyncReady(true);
    window.addEventListener("initialSyncComplete", handleSyncComplete);
    return () => window.removeEventListener("initialSyncComplete", handleSyncComplete);
  }, []);

  // Sort and process data
  const processedOrders = useMemo(() => {
    if (!offlineOrders) return [];
    const list = [...offlineOrders];

    if (sortBy === "totalHighToLow") {
      list.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
    } else if (sortBy === "balanceHighToLow") {
      list.sort((a, b) => {
        const balA = (a.total_amount || 0) - (a.payment?.paid_amount || 0);
        const balB = (b.total_amount || 0) - (b.payment?.paid_amount || 0);
        return balB - balA;
      });
    } else if (tableState.sortConfig) {
      const { key, direction } = tableState.sortConfig;
      list.sort((a, b) => {
        let valA: any = a[key as keyof Order];
        let valB: any = b[key as keyof Order];

        const sortKey = String(key);
        if (sortKey === "customer") {
          valA = a.customer?.name || "";
          valB = b.customer?.name || "";
        } else if (sortKey === "balance") {
          valA = (a.total_amount || 0) - (a.payment?.paid_amount || 0);
          valB = (b.total_amount || 0) - (b.payment?.paid_amount || 0);
        } else if (sortKey === "paid") {
          valA = a.payment?.paid_amount || 0;
          valB = b.payment?.paid_amount || 0;
        } else if (sortKey === "date") {
          valA = new Date(a.sale_date || a.created_at || 0).getTime();
          valB = new Date(b.sale_date || b.created_at || 0).getTime();
        }

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        const comparison = valA < valB ? -1 : 1;
        return direction === "asc" ? comparison : -comparison;
      });
    } else {
      // Default: Sale date desc -> created_at desc -> invoice_no desc
      list.sort((a, b) => {
        const getOrderDayTime = (order: any) => {
          const raw = order.sale_date || order.order_date || order.date || order.created_at;
          if (!raw) return 0;
          const parsed = safeDate(raw, new Date(0));
          return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
        };

        const dateA = getOrderDayTime(a);
        const dateB = getOrderDayTime(b);
        if (dateB !== dateA) return dateB - dateA;

        const createA = a.created_at
          ? new Date(a.created_at).getTime()
          : a.updated_at
          ? new Date(a.updated_at).getTime()
          : 0;
        const createB = b.created_at
          ? new Date(b.created_at).getTime()
          : b.updated_at
          ? new Date(b.updated_at).getTime()
          : 0;
        if (createB !== createA) return createB - createA;

        return (b.invoice_no || b.id || "")
          .toString()
          .localeCompare((a.invoice_no || a.id || "").toString());
      });
    }

    return list;
  }, [offlineOrders, sortBy, tableState.sortConfig]);

  // Feed processed orders into table state for pagination
  useEffect(() => {
    tableState.setRawData(processedOrders);
  }, [processedOrders, tableState]);

  // Handle Order Deletion with Stock & Balance Reversion
  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);

    try {
      // 1. Revert stock and batches locally
      if (orderToDelete.items && Array.isArray(orderToDelete.items)) {
        const { adjustOfflineStock, restoreOfflineBatchesOnSaleRevert } = await import(
          "@/lib/db/offline-stock-manager"
        );

        for (const item of orderToDelete.items) {
          if (item.product_id) {
            const productDoc = await db.products.get(item.product_id.toString());
            if (
              productDoc &&
              (!productDoc.type || productDoc.type === "goods" || productDoc.type === "good")
            ) {
              if (item.quantityType === "damaged") {
                const currentQty = parseFloat(productDoc.damaged_quantity?.toString() || "0");
                const newQty =
                  Math.round((currentQty + (Number(item.quantity) || 0)) * 100000) / 100000;
                await db.products.update(item.product_id.toString(), { damaged_quantity: newQty });
              } else {
                await adjustOfflineStock(item.product_id.toString(), Number(item.quantity) || 0);
              }
            }
          }

          const batchSplits = (item as any).batch_splits;
          if (batchSplits && Array.isArray(batchSplits) && batchSplits.length > 0) {
            await restoreOfflineBatchesOnSaleRevert({ consumedBatches: batchSplits });
          }
        }
      }

      // 2. Revert Balance locally
      const paid =
        orderToDelete.payment && !orderToDelete.payment.no_payment_at_all
          ? orderToDelete.payment.paid_amount || 0
          : 0;
      const netAmount = (orderToDelete.total_amount || 0) - paid;
      if (netAmount !== 0 && orderToDelete.customer_id) {
        await updateOfflinePartyBalance(orderToDelete.customer_id.toString(), -netAmount);
      }

      // 3. Delete locally
      await db.orders.delete(orderToDelete.id.toString());

      // 4. Sync to server
      await SyncEngine.queueOperation(
        "orders",
        "DELETE",
        `/api/orders?id=${orderToDelete.id}`,
        {}
      );

      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
      toast.success(t("orderDeletedSuccess") || "Invoice deleted successfully");
    } catch (err) {
      console.error("Delete order error:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to delete invoice";
      setErrorDialog({
        open: true,
        title: t("error") || "Error",
        message: errMsg,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Setup layout columns and mobile card renderer
  const { columns, renderMobileCard } = useOrderTableLayout({
    t,
    tCommon,
    locale,
    router,
    canView,
    canEdit,
    canDelete,
    setSelectedInvoiceOrder,
    setInvoiceDialogOpen,
    handleDeleteClick: (order) => {
      setOrderToDelete(order);
      setDeleteConfirmOpen(true);
    },
  });

  return (
    <div className="flex-1 space-y-4 w-full mx-auto animate-in fade-in duration-300">
      <PageHeader
        title={t("title") || "Invoices"}
        description={t("pageDescription") || "Track and manage your invoices"}
        mobileActionsRows={1}
        actions={
          canCreate && (
            <Button asChild className="flex items-center gap-2 w-full sm:w-auto">
              <Link href={`/${locale}/admin/sales/invoice/new`}>
                <PlusCircle className="h-4 w-4" />
                <span className="whitespace-nowrap">{t("addInvoice")}</span>
              </Link>
            </Button>
          )
        }
      />

      <div className="w-full flex flex-col">
        <DataTable
          isLoading={isDexieLoading && !isSyncReady}
          sortConfig={tableState.sortConfig}
          onSort={tableState.onSort}
          columns={columns}
          data={tableState.paginatedData}
          keyExtractor={(row) => String(row.id)}
          currentPage={tableState.currentPage}
          onPageChange={tableState.setCurrentPage}
          pageSize={tableState.pageSize}
          onPageSizeChange={tableState.setPageSize}
          totalCount={tableState.totalCount}
          emptyMessage={t("noOrdersFound")}
          searchTerm={tableState.searchTerm}
          onSearchChange={tableState.setSearchTerm}
          searchPlaceholder={t("searchPlaceholder")}
          toolbarActions={
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter By Status Dropdown */}
              {/* <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9 px-3 text-xs">
                    <FilterIcon className="w-3.5 h-3.5" />
                    <span>{t("filters") || "Filter"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{t("filterByStatus") || "Filter by Status"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "all"}
                    onCheckedChange={() => {
                      setStatusFilter("all");
                      tableState.setCurrentPage(1);
                    }}
                  >
                    {t("allStatuses") || "All Statuses"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "completed"}
                    onCheckedChange={() => {
                      setStatusFilter("completed");
                      tableState.setCurrentPage(1);
                    }}
                  >
                    {t("completed") || "Completed"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "pending"}
                    onCheckedChange={() => {
                      setStatusFilter("pending");
                      tableState.setCurrentPage(1);
                    }}
                  >
                    {t("pending") || "Pending"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "cancelled"}
                    onCheckedChange={() => {
                      setStatusFilter("cancelled");
                      tableState.setCurrentPage(1);
                    }}
                  >
                    {t("cancelled") || "Cancelled"}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu> */}

              {/* Sort By Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9 px-3 text-xs">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>{t("sort") || "Sort"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{t("sortBy") || "Sort By"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "default"}
                    onCheckedChange={() => {
                      setSortBy("default");
                      tableState.setCurrentPage(1);
                    }}
                  >
                    {t("default") || "Default"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "totalHighToLow"}
                    onCheckedChange={() => {
                      setSortBy("totalHighToLow");
                      tableState.setCurrentPage(1);
                    }}
                  >
                    {t("totalHighToLow") || "Total (High to Low)"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "balanceHighToLow"}
                    onCheckedChange={() => {
                      setSortBy("balanceHighToLow");
                      tableState.setCurrentPage(1);
                    }}
                  >
                    {t("balanceHighToLow") || "Balance (High to Low)"}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
          renderMobileCard={renderMobileCard}
        />
      </div>

      {/* Invoice Preview Dialog */}
      {selectedInvoiceOrder && (
        <InvoicePreviewDialog
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          invoiceNo={selectedInvoiceOrder.invoice_no || `ORD-${selectedInvoiceOrder.id}`}
          customer={selectedInvoiceOrder.customer || { name: "-" }}
          saleDate={selectedInvoiceOrder.sale_date || selectedInvoiceOrder.created_at}
          dueDate={selectedInvoiceOrder.due_date || null}
          products={(selectedInvoiceOrder.items || []).map((item, index) => ({
            id: index,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            quantity_str: (item as any).quantity_str,
            sell_price: item.price,
            unit_of_measurement: item.unit_of_measurement,
            discount: item.discount,
            discountType: item.discountType,
          }))}
          subtotal={selectedInvoiceOrder.subtotal || selectedInvoiceOrder.total_amount}
          charges={selectedInvoiceOrder.charges || []}
          overallDiscount={selectedInvoiceOrder.overallDiscount || 0}
          shippingCharges={selectedInvoiceOrder.shippingCharges || 0}
          total={selectedInvoiceOrder.total_amount}
          onMakePayment={() => {}}
          hidePaymentActions={true}
          initialPayment={
            selectedInvoiceOrder.payment
              ? {
                  method: selectedInvoiceOrder.payment.method || "cash",
                  paid_amount: selectedInvoiceOrder.payment.paid_amount || 0,
                  paid_date: selectedInvoiceOrder.payment.paid_date || "",
                  no_payment_at_all: Boolean(selectedInvoiceOrder.payment.no_payment_at_all),
                }
              : null
          }
          customerNotes={selectedInvoiceOrder.customer_notes}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t("confirmDeletion") || "Confirm Deletion"}
        description={
          t("confirmDeleteMessage", {
            invoiceNo: orderToDelete?.invoice_no || `ORD-${orderToDelete?.id}`,
          }) || "Are you sure you want to delete this invoice?"
        }
        onConfirm={handleDeleteOrder}
        isLoading={isDeleting}
        variant="destructive"
        confirmLabel={t("delete") || "Delete"}
        cancelLabel={t("cancel") || "Cancel"}
      />

      {/* Error Dialog */}
      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
        title={errorDialog.title}
        message={errorDialog.message}
      />
    </div>
  );
}