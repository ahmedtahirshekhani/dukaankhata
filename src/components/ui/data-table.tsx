import React from "react";
import {
  Card,
  CardContent,
  CardHeader
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  sortConfig?: SortConfig;
  onSort?: (key: any) => void;
  enableRowSelection?: boolean;
  selectedRowIds?: (string | number)[];
  onSelectRow?: (rowId: any, selected: boolean) => void;
  onSelectAll?: (selected: boolean, pageRowIds: any[]) => void;
  pageSize?: number;
  currentPage?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  rowClassName?: (row: T) => string;
  keyExtractor: (row: T, index: number) => string;
  renderMobileCard?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  toolbarActions?: React.ReactNode;
  bulkActions?: React.ReactNode;
}

export interface ColumnDef<T> {
  id?: string;
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, rowIndex: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  sortConfig,
  onSort,
  enableRowSelection = false,
  selectedRowIds = [],
  onSelectRow,
  onSelectAll,
  pageSize = 10,
  currentPage = 1,
  totalCount = 0,
  onPageChange,
  onPageSizeChange,
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  emptyMessage,
  rowClassName,
  keyExtractor,
  renderMobileCard,
  onRowClick,
  toolbarActions,
  bulkActions,
}: DataTableProps<T>) {
  const tCommon = useTranslations("common");

  const totalPages = Math.ceil(totalCount / pageSize);
  const pageRowIds = React.useMemo(() => data.map((row, index) => keyExtractor(row, index)), [data, keyExtractor]);
  const isAllSelected = pageRowIds.length > 0 && pageRowIds.every(id => selectedRowIds.includes(id));
  const isSomeSelected = pageRowIds.some(id => selectedRowIds.includes(id)) && !isAllSelected;

  return (
    <Card className="flex flex-col flex-1 p-2 sm:p-6">
        <CardHeader className="p-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
            {onSearchChange && (
              <div className="relative w-full sm:w-64 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder || tCommon("search") || "Search..."}
                  value={searchTerm || ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 h-10 w-full"
                />
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto sm:flex-1 sm:overflow-x-auto sm:scrollbar-none">
              {toolbarActions && (
                <div className="w-full sm:w-auto flex-shrink-0">
                  {toolbarActions}
                </div>
              )}
              {selectedRowIds.length > 0 && bulkActions && (
                <div className="flex items-center gap-2 sm:ml-1 sm:border-l sm:pl-4 sm:border-border w-full sm:w-auto flex-shrink-0">
                  {bulkActions}
                </div>
              )}
            </div>
          </div>
        </CardHeader>

      <CardContent className="p-0 relative flex flex-col flex-1">
        {/* Desktop View */}
        <div className="hidden md:block w-full overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {enableRowSelection && (
                  <TableHead className="w-12 pl-4">
                    <Checkbox
                      checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
                      onCheckedChange={(checked) => onSelectAll?.(!!checked, pageRowIds)}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                {columns.map((col, i) => (
                  <TableHead 
                    key={col.id || i.toString()} 
                    className={cn(col.className, col.sortable && col.accessorKey ? "cursor-pointer select-none hover:text-foreground" : "")}
                    onClick={() => {
                      if (col.sortable && col.accessorKey && onSort) {
                        onSort(col.accessorKey);
                      }
                    }}
                  >
                    <div className={cn("flex items-center gap-1.5", col.className?.includes("text-right") || col.className?.includes("justify-end") ? "justify-end" : "")}>
                      {col.header}
                      {col.sortable && col.accessorKey && (
                        <div className="w-4">
                          {sortConfig?.key === col.accessorKey ? (
                            sortConfig.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-20" />
                          )}
                        </div>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && data.length === 0 ? (
                Array.from({ length: pageSize || 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    {enableRowSelection && (
                      <TableCell className="pl-4">
                        <Skeleton className="h-4 w-4 rounded" />
                      </TableCell>
                    )}
                    {columns.map((col, cIdx) => (
                      <TableCell key={cIdx}>
                        <Skeleton className="h-5 w-[80%] rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + (enableRowSelection ? 1 : 0)} className="h-48">
                    <EmptyState title={emptyMessage || tCommon("noData") || "No data available."} />
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, rowIndex) => {
                  const rowId = keyExtractor(row, rowIndex);
                  const isSelected = selectedRowIds.includes(rowId);
                  return (
                    <TableRow
                      key={rowId}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                        onRowClick?.(row);
                      }}
                      className={cn(onRowClick ? "cursor-pointer hover:bg-muted/50" : "", isSelected ? "bg-muted/30" : "", rowClassName?.(row) || "")}
                    >
                      {enableRowSelection && (
                        <TableCell className="pl-4">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => onSelectRow?.(rowId, !!checked)}
                            aria-label="Select row"
                          />
                        </TableCell>
                      )}
                      {columns.map((col, colIndex) => (
                        <TableCell key={col.id || colIndex.toString()} className={col.className}>
                          {col.cell ? col.cell(row, rowIndex) : col.accessorKey ? String((row as any)[col.accessorKey] || "") : null}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-3 w-full">
          {isLoading && data.length === 0 ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="border rounded-lg p-4 shadow-sm bg-card space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex justify-between pt-2">
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="border rounded-lg bg-card shadow-sm">
              <EmptyState title={emptyMessage || tCommon("noData") || "No data available."} />
            </div>
          ) : (
            data.map((row, rowIndex) => {
              const rowId = keyExtractor(row, rowIndex);
              const isSelected = selectedRowIds.includes(rowId);
              return (
                <div 
                  key={rowId} 
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                    onRowClick?.(row);
                  }}
                  className="relative"
                >
                  {enableRowSelection && (
                    <div className="absolute top-4 left-4 z-10">
                       <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => onSelectRow?.(rowId, !!checked)}
                       />
                    </div>
                  )}
                  {renderMobileCard ? (
                    renderMobileCard(row)
                  ) : (
                    <div className={`border rounded-lg p-4 shadow-sm bg-card space-y-3 ${rowClassName?.(row) || ""} ${enableRowSelection ? "pl-12" : ""}`}>
                      {columns.map((col, colIndex) => (
                        <div key={col.id || colIndex.toString()} className="flex justify-between items-center gap-4 py-1 border-b border-border/50 last:border-0 last:pb-0">
                          <div className="text-xs text-muted-foreground font-medium">
                            {col.header}
                          </div>
                          <div className="text-sm text-right flex items-center justify-end">
                            {col.cell ? col.cell(row, rowIndex) : col.accessorKey ? String((row as any)[col.accessorKey] || "") : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {(onPageChange || onPageSizeChange) && (
          <div className="flex flex-col md:flex-row justify-between items-center pt-4 sm:pt-6 mt-4 border-t gap-4">
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

