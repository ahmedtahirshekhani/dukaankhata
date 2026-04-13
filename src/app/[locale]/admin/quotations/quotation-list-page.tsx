"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Trash2, EyeIcon, Loader2 } from "lucide-react";
import { formatCurrencyString } from "@/lib/utils";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ErrorDialog } from "@/components/dialogs/error-dialog";

export default function QuotationListPage() {
  const t = useTranslations();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quotationToDelete, setQuotationToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isSuccess?: boolean;
  }>({ open: false, message: "" });

  const fetchQuotations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/${locale}/api/quotations`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      let quotationsArray = [];
      if (Array.isArray(data)) {
        quotationsArray = data;
      } else if (data.quotations && Array.isArray(data.quotations)) {
        quotationsArray = data.quotations;
      } else if (data.data && Array.isArray(data.data)) {
        quotationsArray = data.data;
      } else {
        quotationsArray = [];
      }
      
      setQuotations(quotationsArray);
    } catch (error) {
      console.error("Fetch error:", error);
      let message = "Unknown error";
      if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
        message = (error as any).message;
      } else if (typeof error === "string") {
        message = error;
      }
      setError(message);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [locale]);

  const handleDeleteClick = (quotation: any) => {
    setQuotationToDelete(quotation);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quotationToDelete) return;
    const id = quotationToDelete._id || quotationToDelete.id;
    setIsDeleting(true);
    try {
      const res = await fetch(`/${locale}/api/quotations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setQuotations(quotations.filter((q) => (q._id || q.id) !== id));
        setErrorDialog({
          open: true,
          title: tCommon("success"),
          message: "Quotation deleted successfully",
          isSuccess: true,
        });
      } else {
        const errorData = await res.json();
        throw new Error(errorData?.error || "Failed to delete quotation");
      }
    } catch (error) {
      setErrorDialog({
        open: true,
        title: tCommon("error"),
        message: error instanceof Error ? error.message : "Error deleting quotation",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setQuotationToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-6">
        <div className="flex justify-center items-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <h3 className="font-semibold">Error loading quotations</h3>
          <p className="text-sm">{error}</p>
          <Button onClick={fetchQuotations} className="mt-2" variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-4 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tNav("quotations")}</h1>
          <p className="text-sm text-muted-foreground">{tNav("quotationsDescription")}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="./quotations/new">{t("common.add")}</Link>
        </Button>
      </div>

      {quotations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No quotations found. Create your first quotation!
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q, i) => {
                  const quotId = q._id || q.id;
                  return (
                    <TableRow key={quotId}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{q.party_name || "-"}</TableCell>
                      <TableCell>{formatCurrencyString(q.total_amount || 0)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          q.status === "converted" ? "bg-green-100 text-green-700" :
                          q.status === "expired" ? "bg-red-100 text-red-700" :
                          q.status === "cancelled" ? "bg-gray-100 text-gray-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {q.status || "open"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {q.validity_date ? new Date(q.validity_date).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        {q.created_at ? new Date(q.created_at).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`./quotations/${quotId}/view`}>
                              <EyeIcon className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`./quotations/${quotId}/edit`}>
                              {t("common.edit")}
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(q)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-3">
            {quotations.map((q, i) => {
              const quotId = q._id || q.id;
              return (
                <QuotationCard
                  key={quotId}
                  quotation={q}
                  index={i}
                  onDelete={() => handleDeleteClick(q)}
                  t={t}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Quotation"
        description={`Are you sure you want to delete quotation for ${quotationToDelete?.party_name || "this party"}?`}
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />

      {/* Error/Success Dialog */}
      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
        title={errorDialog.title}
        message={errorDialog.message}
        isSuccess={errorDialog.isSuccess}
      />
    </div>
  );
}

// Mobile Card Component
function QuotationCard({
  quotation,
  index,
  onDelete,
  t,
}: {
  quotation: any;
  index: number;
  onDelete: () => void;
  t: (key: string) => string;
}) {
  const quotId = quotation._id || quotation.id;
  
  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-base">
            #{index + 1} • {quotation.party_name || "-"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {quotation.created_at ? new Date(quotation.created_at).toLocaleDateString() : "-"}
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          quotation.status === "converted" ? "bg-green-100 text-green-700" :
          quotation.status === "expired" ? "bg-red-100 text-red-700" :
          quotation.status === "cancelled" ? "bg-gray-100 text-gray-700" :
          "bg-yellow-100 text-yellow-700"
        }`}>
          {quotation.status || "open"}
        </span>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("common.total") || "Total"}:</span>
          <span className="font-medium">{formatCurrencyString(quotation.total_amount || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Validity:</span>
          <span>{quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString() : "-"}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
        <Button size="sm" variant="ghost" asChild>
          <Link href={`./quotations/${quotId}/view`}>
            <EyeIcon className="h-4 w-4 mr-1" />
            {t("common.view") || "View"}
          </Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`./quotations/${quotId}/edit`}>
            {t("common.edit")}
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}