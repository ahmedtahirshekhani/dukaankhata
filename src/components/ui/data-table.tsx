import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { Loader2Icon, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface ColumnDef<TData> {
  id?: string;
  header: React.ReactNode;
  accessorKey?: keyof TData;
  cell?: (row: TData, index: number) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  keyExtractor: (row: TData, index: number) => string;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  totalCount?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
  
  // Search & Toolbar Props
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  toolbarActions?: React.ReactNode;
  renderMobileCard?: (row: TData) => React.ReactNode;
}

export function DataTable<TData>({
  columns,
  data,
  keyExtractor,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  pageSize = 10,
  onPageSizeChange,
  totalCount = 0,
  isLoading = false,
  emptyMessage,
  onRowClick,
  rowClassName,
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  toolbarActions,
  renderMobileCard,
}: DataTableProps<TData>) {
  const tCommon = useTranslations("common");

  return (
    <Card className="flex flex-col w-full h-full border-none sm:border-solid shadow-none sm:shadow-sm">
      {(onSearchChange || toolbarActions) && (
        <CardHeader className="p-0 sm:p-6 pb-4 sm:pb-4 border-b-0 sm:border-b mb-2 sm:mb-0">
          <div className="flex flex-col sm:flex-row gap-4">
            {onSearchChange && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder || tCommon("search") || "Search..."}
                  value={searchTerm || ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 h-10 w-full"
                />
              </div>
            )}
            {toolbarActions && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
                {toolbarActions}
              </div>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className="p-0 flex flex-col flex-1">
        {/* Desktop View */}
        <div className="hidden md:block w-full overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((col, i) => (
                  <TableHead key={col.id || i.toString()} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <Loader2Icon className="animate-spin h-6 w-6 text-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    {emptyMessage || tCommon("noData") || "No data available."}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, rowIndex) => (
                  <TableRow
                    key={keyExtractor(row, rowIndex)}
                    onClick={() => onRowClick?.(row)}
                    className={`${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""} ${rowClassName?.(row) || ""}`}
                  >
                    {columns.map((col, colIndex) => (
                      <TableCell key={col.id || colIndex.toString()} className={col.className}>
                        {col.cell ? col.cell(row, rowIndex) : null}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-3 w-full p-4 pt-0 sm:p-0">
          {isLoading && data.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground border rounded-lg bg-card shadow-sm">
              <Loader2Icon className="h-8 w-8 animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-card shadow-sm text-sm">
              {emptyMessage || tCommon("noData") || "No data available."}
            </div>
          ) : (
            data.map((row, rowIndex) => (
              <div 
                key={keyExtractor(row, rowIndex)} 
                onClick={() => onRowClick?.(row)}
              >
                {renderMobileCard ? (
                  renderMobileCard(row)
                ) : (
                  <div className={`border rounded-lg p-4 shadow-sm bg-card space-y-3 ${rowClassName?.(row) || ""}`}>
                    {columns.map((col, colIndex) => (
                      <div key={col.id || colIndex.toString()} className="flex justify-between items-center gap-4 py-1 border-b border-border/50 last:border-0 last:pb-0">
                        <div className="text-xs text-muted-foreground font-medium">
                          {col.header}
                        </div>
                        <div className="text-sm text-right flex items-center justify-end">
                          {col.cell ? col.cell(row, rowIndex) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {(onPageChange || onPageSizeChange) && (
          <div className="flex flex-col md:flex-row justify-between items-center px-4 sm:px-6 py-4 border-t gap-4 bg-card sm:rounded-b-xl mt-auto">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <div className="text-sm text-muted-foreground whitespace-nowrap text-center sm:text-left">
                Showing {data.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
              </div>
              {onPageSizeChange && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
                  <Select value={pageSize.toString()} onValueChange={(value) => onPageSizeChange(parseInt(value))} disabled={isLoading}>
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={pageSize.toString()} />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map((size) => (
                        <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {onPageChange && totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
