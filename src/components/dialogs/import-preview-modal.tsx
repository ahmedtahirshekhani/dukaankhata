"use client";

import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2Icon, Trash2 } from "lucide-react";

export interface ImportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Record<string, any>[];
  columns: string[];
  isLoading?: boolean;
  onConfirm: (editedData: Record<string, any>[]) => Promise<void>;
  title?: string;
  description?: string;
}

export function ImportPreviewModal({
  open,
  onOpenChange,
  data,
  columns,
  isLoading = false,
  onConfirm,
  title,
  description,
}: ImportPreviewModalProps) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const [previewData, setPreviewData] = useState<Record<string, any>[]>(data);
  const [isConfirming, setIsConfirming] = useState(false);

  // Update preview data when prop data changes
  const handleEditCell = useCallback(
    (rowIndex: number, columnName: string, value: any) => {
      setPreviewData((prev) => {
        const updated = [...prev];
        updated[rowIndex] = {
          ...updated[rowIndex],
          [columnName]: value,
        };
        return updated;
      });
    },
    []
  );

  const handleDeleteRow = useCallback((rowIndex: number) => {
    setPreviewData((prev) => prev.filter((_, i) => i !== rowIndex));
  }, []);

  const handleConfirm = useCallback(async () => {
    try {
      setIsConfirming(true);
      await onConfirm(previewData);
    } finally {
      setIsConfirming(false);
    }
  }, [previewData, onConfirm]);

  const handleClose = useCallback(() => {
    setPreviewData(data);
    onOpenChange(false);
  }, [data, onOpenChange]);

  // Update preview data when data prop changes
  if (open && previewData.length === 0 && data.length > 0) {
    setPreviewData(data);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {title || t("importPreview") || "Import Preview"}
          </DialogTitle>
          <DialogDescription>
            {description ||
              t("editImportData") ||
              "Edit the data below before confirming the import"}
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b">
                <th className="p-2 text-left w-12">
                  <span className="font-semibold">#</span>
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="p-2 text-left font-semibold border-r last:border-r-0 min-w-[150px]"
                  >
                    {col}
                  </th>
                ))}
                <th className="p-2 text-center w-12">
                  <span className="font-semibold">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b hover:bg-muted/50">
                  <td className="p-2 text-center text-xs font-semibold text-muted-foreground">
                    {rowIndex + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={`${rowIndex}-${col}`}
                      className="p-2 border-r last:border-r-0"
                    >
                      <input
                        type="text"
                        value={row[col] ?? ""}
                        onChange={(e) =>
                          handleEditCell(rowIndex, col, e.target.value)
                        }
                        className="w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-background"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleDeleteRow(rowIndex)}
                      className="text-red-500 hover:text-red-700 transition"
                      title="Delete row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-muted-foreground mt-2">
          {t("totalRows") || "Total rows"}: {previewData.length}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isConfirming}>
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming || previewData.length === 0 || isLoading}
          >
            {isConfirming || isLoading ? (
              <>
                <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                {t("importing") || "Importing..."}
              </>
            ) : (
              t("import") || "Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
