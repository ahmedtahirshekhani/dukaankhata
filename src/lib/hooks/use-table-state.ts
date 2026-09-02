import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";

export interface SortConfig<T> {
  key: keyof T;
  direction: "asc" | "desc";
}

interface UseTableStateProps<T> {
  initialData?: T[];
  defaultPageSize?: number;
  searchFields?: (keyof T)[];
  searchDelay?: number;
  defaultSort?: SortConfig<T>;
}

const EMPTY_ARRAY: any[] = [];
const DEFAULT_SEARCH_FIELDS: any[] = [];

export function useTableState<T extends { id?: string | number }>({
  initialData = EMPTY_ARRAY as T[],
  defaultPageSize = 10,
  searchFields = DEFAULT_SEARCH_FIELDS as (keyof T)[],
  searchDelay = 300,
  defaultSort,
}: UseTableStateProps<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, searchDelay);

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | undefined>(defaultSort);

  // Selection
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string | number>>(new Set());

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize]);

  // Update internal data when prop data changes
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleSort = (key: keyof T) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        return undefined; // clear sort on 3rd click
      }
      return { key, direction: "asc" };
    });
  };

  const handleSelectRow = (id: string | number, selected: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (selected: boolean, currentPageIds: (string | number)[]) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        currentPageIds.forEach((id) => next.add(id));
      } else {
        currentPageIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedRowIds(new Set());

  // Compute filtered, sorted, and paginated results
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Simple search filtering
    if (debouncedSearchTerm && searchFields.length > 0) {
      const lowercasedSearch = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        return searchFields.some((field) => {
          const val = item[field];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(lowercasedSearch);
        });
      });
    }

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        const comparison = valA < valB ? -1 : 1;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    // Slice for current page
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return {
      totalCount,
      totalPages,
      paginatedData: paginated,
    };
  }, [data, debouncedSearchTerm, searchFields, currentPage, pageSize, sortConfig]);

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    sortConfig,
    onSort: handleSort,
    selectedRowIds: Array.from(selectedRowIds),
    onSelectRow: handleSelectRow,
    onSelectAll: handleSelectAll,
    clearSelection,
    totalCount: processedData.totalCount,
    totalPages: processedData.totalPages,
    paginatedData: processedData.paginatedData,
    rawData: data,
    setRawData: setData,
  };
}
