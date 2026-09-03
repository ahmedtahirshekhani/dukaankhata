import React from 'react';
import { ColumnDef } from "@/components/ui/data-table";
import { TableRowActions } from "@/components/ui/table-row-actions";
import { Customer } from "@/components/customers/customer-form-modal";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Receipt, Eye } from "lucide-react";

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" {...props}>
    <path d="M12.004 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.89 5.86L2.5 22.5l4.81-1.35c1.42.75 3.01 1.18 4.69 1.18 5.52 0 10-4.48 10-10S17.52 2 12.004 2zm5.72 13.91c-.24.67-1.19 1.25-1.92 1.34-.5.06-1.15.09-3.32-.82-2.77-1.17-4.52-4.06-4.66-4.25-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.95-2.29.25-.28.55-.35.74-.35.19 0 .38.01.55.02.18.01.42-.07.65.48.24.58.82 2.01.89 2.15.07.14.12.31.02.5-.1.19-.15.31-.31.5-.16.19-.34.42-.48.56-.16.16-.33.33-.14.65.19.32.85 1.4 1.83 2.27.84.75 1.55.98 1.87 1.12.32.14.51.12.7-.1.19-.22.82-.95 1.04-1.28.22-.33.44-.28.74-.17.3.11 1.91.9 2.23 1.06.32.16.53.24.61.38.08.14.08.8-.16 1.47z" />
  </svg>
);

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
          Rs. {row.balance ? Math.round(row.balance) : "0"}
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
          row.is_default ||
          row.type === "cash" ||
          row.name?.toLowerCase() === "cash sale" ||
          row.name?.toLowerCase() === "cash party"
        );

        return (
          <TableRowActions
            canEdit={canEdit}
            canDelete={canDelete && !isDefaultParty}
            onEdit={() => {
              setCustomerToEdit(row);
              setIsFormModalOpen(true);
            }}
            onDelete={() => {
              if (isDefaultParty) {
                if (setErrorDialog) {
                  setErrorDialog({
                    open: true,
                    title: t("cannotDelete") || "Cannot Delete",
                    message: t("cannotDeleteDefaultParty") || "This is a default Cash Sale party and cannot be deleted.",
                  });
                }
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
  ], [t, tCommon, tDash, tInvoice, locale, router, canView, canEdit, canDelete, setCustomerToView, setIsViewModalOpen, setCustomerToEdit, setIsFormModalOpen, setCustomerToDelete, setIsDeleteDialogOpen, handleWhatsAppClick, setErrorDialog]);

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
          <span className="font-medium text-sm flex gap-2">
            {customer.balance ? Math.round(customer.balance) : 0} <span className="text-muted-foreground">{t("currencySymbol") || "Rs."}</span>
          </span>
        </div>
      </div>
    </Card>
  ), [columns, t]);

  return { columns, renderMobileCard };
}
