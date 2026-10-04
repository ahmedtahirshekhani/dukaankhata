import React from 'react';
import { ColumnDef } from "@/components/ui/data-table";
import { TableRowActions } from "@/components/ui/table-row-actions";
import { Customer } from "@/components/customers/customer-form-modal";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { Receipt, Eye } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { toast } from "sonner";

export interface UseCustomerTableLayoutProps {
  t: (key: string) => string;
  tCommon: (key: string) => string;
  tDash: (key: string) => string;
  tInvoice: (key: string) => string;
  locale: string;
  router: any;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  setCustomerToView: (c: Customer) => void;
  setIsViewModalOpen: (b: boolean) => void;
  setCustomerToEdit: (c: Customer) => void;
  setIsFormModalOpen: (b: boolean) => void;
  setCustomerToDelete: (c: Customer) => void;
  setIsDeleteDialogOpen: (b: boolean) => void;
  handleWhatsAppClick: (c: Customer) => void;
  setErrorDialog?: (dialog: { open: boolean; title?: string; message: string }) => void;
}

export function useCustomerTableLayout({
  t, tCommon, tDash, tInvoice, locale, router,
  canView, canEdit, canDelete,
  setCustomerToView, setIsViewModalOpen,
  setCustomerToEdit, setIsFormModalOpen,
  setCustomerToDelete, setIsDeleteDialogOpen,
  handleWhatsAppClick,
  setErrorDialog
}: UseCustomerTableLayoutProps) {
  
  const columns = React.useMemo<ColumnDef<Customer>[]>(() => [
    {
      id: "name",
      header: t("nameLabel"),
      accessorKey: "name",
      sortable: true,
    },
    {
      id: "phone",
      header: t("phoneLabel"),
      cell: (row) => row.phone || "-",
    },
    {
      id: "company",
      header: t("companyName"),
      cell: (row) => row.company_name || "-",
    },
    {
      id: "balance",
      header: t("balance"),
      accessorKey: "balance",
      sortable: true,
      cell: (row) => (
        <span className={row.balance && row.balance < 0 ? "text-red-600 font-medium" : row.balance && row.balance > 0 ? "text-green-600 font-medium" : ""}>
          {formatCurrency(row.balance)}
        </span>
      ),
    },
    {
      id: "actions",
      header: <div className="text-right">{tCommon("actions") || "Actions"}</div>,
      className: "text-right",
      cell: (row) => {
        const extraActions = [];

        if (canView) {
          extraActions.push({
            label: tDash("viewTransactions") || "View Transactions",
            icon: <Receipt className="w-4 h-4" />,
            onClick: () => router.push(`/${locale}/admin/customer-transactions/${row.id}`)
          });
          extraActions.push({
            label: t("view") || "View Details",
            icon: <Eye className="w-4 h-4" />,
            onClick: () => {
              setCustomerToView(row);
              setIsViewModalOpen(true);
            }
          });
        }
        if (row.balance !== undefined && row.balance > 0) {
          extraActions.push({
            label: tInvoice("sendOnWhatsApp") || "Send Message",
            icon: <WhatsAppIcon className="w-4 h-4 text-green-600" />,
            onClick: () => handleWhatsAppClick(row)
          });
        }

        const isDefaultParty = Boolean(
          row.is_default === true ||
          (row as any).is_default === 1 ||
          String(row.is_default).toLowerCase() === "true" ||
          row.type === "cash" ||
          row.name?.trim().toLowerCase() === "cash sale" ||
          row.name?.trim().toLowerCase() === "cash party" ||
          row.name?.trim().toLowerCase() === "cash customer"
        );

        return (
          <TableRowActions
            align="right"
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => {
              if (isDefaultParty) {
                toast.error(t("cannotEditDefaultParty"));
                return;
              }
              setCustomerToEdit(row);
              setIsFormModalOpen(true);
            }}
            onDelete={() => {
              if (isDefaultParty) {
                toast.error(t("cannotDeleteDefaultParty"));
                return;
              }
              setCustomerToDelete(row);
              setIsDeleteDialogOpen(true);
            }}
            extraActions={extraActions}
          />
        );
      }
    }
  ], [t, tCommon, tDash, tInvoice, locale, router, canView, canEdit, canDelete, setCustomerToView, setIsViewModalOpen, setCustomerToEdit, setIsFormModalOpen, setCustomerToDelete, setIsDeleteDialogOpen, handleWhatsAppClick]);

  const renderMobileCard = React.useCallback((customer: Customer) => (
    <Card
      className={cn(
        "py-4 pr-3 pl-11 border shadow-sm",
        customer.balance !== undefined && customer.balance < 0 ? "bg-red-100/70 dark:bg-red-950/50 border-red-200 dark:border-red-800" :
          customer.balance !== undefined && customer.balance > 0 ? "bg-green-100/70 dark:bg-green-950/50 border-green-200 dark:border-green-800" :
            "bg-card border-border"
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold text-sm">{customer.name}</p>
            <p className="text-xs text-muted-foreground">{customer.phone || "-"}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0 bg-background/50 rounded-md">
            {columns.find(c => c.id === "actions")?.cell?.(customer, 0)}
          </div>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">{t("companyNameLabel")}: {customer.company_name || "-"}</span>
          <span className="font-medium text-sm">
            {formatCurrency(customer.balance)}
          </span>
        </div>
      </div>
    </Card>
  ), [columns, t]);

  return { columns, renderMobileCard };
}
