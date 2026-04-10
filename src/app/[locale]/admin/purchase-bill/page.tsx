"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { formatCurrencyString } from "@/lib/utils";

interface PurchaseBillItem {
  id: string;
  product_id: string;
  product_name: string;
  product_description?: string;
  quantity: number;
  cost_price: number;
  amount: number;
}

interface PurchaseBill {
  id?: string;
  party_id: string;
  party_name: string;
  items: PurchaseBillItem[];
  discount: number;
  discount_type: "percentage" | "fixed";
  tax: number;
  tax_type: "percentage" | "fixed";
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  is_paid: boolean;
  payment_method_id?: string;
  payment_method_name?: string;
  description?: string;
  created_at?: string;
}

export default function PurchaseBillPage() {
  const t = useTranslations("purchaseBill");
  const locale = useLocale();
  const router = useRouter();

  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);

  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isSuccess?: boolean;
  }>({
    open: false,
    message: "",
  });

  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    billId?: string;
  }>({ open: false });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchBills = async () => {
      try {
        const billsRes = await fetch(`/${locale}/api/purchase-bills`);
        if (billsRes.ok) {
          const data = await billsRes.json();
          setBills(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error fetching bills:", error);
        setErrorDialog({
          open: true,
          title: t("error"),
          message: t("failedToLoadData"),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [locale, t]);

  const handleDeleteBill = useCallback(async (billId: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/${locale}/api/purchase-bills?id=${billId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(t("failedToDeleteBill"));
      }

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("deleteSuccess"),
        isSuccess: true,
      });

      // Refresh bills list
      const billsRes = await fetch(`/${locale}/api/purchase-bills`);
      if (billsRes.ok) {
        const data = await billsRes.json();
        setBills(Array.isArray(data) ? data : []);
      }

      setDeleteConfirmDialog({ open: false });
    } catch (error) {
      setErrorDialog({
        open: true,
        title: t("error"),
        message: error instanceof Error ? error.message : t("failedToDeleteBill"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [locale, t]);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {t("title") || "Purchase Bill"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("purchaseBilldescription") || "Manage purchase bills"}
          </p>
        </div>
        <Button
          onClick={() => router.push(`/${locale}/admin/purchase-bill/new`)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("addBills") || "Add Purchase Bill"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("purchaseBills") || "Purchase Bills"}</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t("noBills") || "No purchase bills found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("partyName") || "Party"}</TableHead>
                    <TableHead className="text-right">{t("totalAmount") || "Total"}</TableHead>
                    <TableHead className="text-right">{t("paidAmount") || "Paid"}</TableHead>
                    <TableHead className="text-right">{t("balanceDue") || "Balance"}</TableHead>
                    <TableHead>{t("status") || "Status"}</TableHead>
                    <TableHead>{t("date") || "Date"}</TableHead>
                    <TableHead className="text-right">{t("actions") || "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">
                        {bill.party_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyString(bill.total_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyString(bill.paid_amount || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyString(bill.balance_due || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={bill.is_paid ? "default" : "secondary"}
                        >
                          {bill.is_paid ? t("paid") || "Paid" : t("pending") || "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {bill.created_at
                          ? new Date(bill.created_at).toLocaleDateString(locale)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/${locale}/admin/purchase-bill/new?id=${bill.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDeleteConfirmDialog({ open: true, billId: bill.id });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmDialog.open}
        onOpenChange={(open) => setDeleteConfirmDialog({ ...deleteConfirmDialog, open })}
        title={t("deleteBill") || "Delete Bill"}
        description={t("confirmDelete") || "Are you sure?"}
        onConfirm={() => {
          if (deleteConfirmDialog.billId) {
            handleDeleteBill(deleteConfirmDialog.billId);
          }
        }}
        isDestructive
        isLoading={isSaving}
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) =>
          setErrorDialog((prev) => ({ ...prev, open }))
        }
        title={errorDialog.title}
        message={errorDialog.message}
        isSuccess={errorDialog.isSuccess}
      />
    </div>
  );
}

