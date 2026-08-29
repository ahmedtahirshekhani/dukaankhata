import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";

interface UseTableStateProps<T> {
  initialData?: T[];
  defaultPageSize?: number;
  searchFields?: (keyof T)[];
  searchDelay?: number;
}

const EMPTY_ARRAY: any[] = [];
const DEFAULT_SEARCH_FIELDS: any[] = [];

export function useTableState<T>({
  initialData = EMPTY_ARRAY as T[],
  defaultPageSize = 10,
  searchFields = DEFAULT_SEARCH_FIELDS as (keyof T)[],
  searchDelay = 500,
}: UseTableStateProps<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, searchDelay);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize]);

  // Update internal data when prop data changes
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Compute filtered and paginated results
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
  }, [data, debouncedSearchTerm, searchFields, currentPage, pageSize]);

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    totalCount: processedData.totalCount,
    totalPages: processedData.totalPages,
    paginatedData: processedData.paginatedData,
    rawData: data,
    setRawData: setData,
  };
}
