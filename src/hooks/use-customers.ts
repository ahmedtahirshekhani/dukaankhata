import { useCallback, useContext } from "react";
import { CustomersContext } from "@/components/dropdown/customers-context";

type Party = {
  id: string | number;
  _id?: string | number;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  company_address?: string;
  balance?: number;
  status?: "active" | "inactive";
  is_delete?: number;
};

interface FetchPartiesOptions {
  page?: number;
  limit?: number;
  search?: string;
  filterActiveOnly?: boolean;
  append?: boolean;
}

export interface UseCustomersReturn {
  customers: Party[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  fetchCustomers: (options: FetchPartiesOptions) => Promise<void>;
  revalidate: () => Promise<void>;
}

const ITEMS_PER_PAGE = 20;

export function useCustomers(): UseCustomersReturn {
  const context = useContext(CustomersContext);

  if (!context) {
    throw new Error("useCustomers must be used within CustomersProvider");
  }

  const {
    customers,
    loading,
    loadingMore,
    hasMore,
    error,
    setCustomers,
    setLoading,
    setLoadingMore,
    setHasMore,
    setError,
    cache,
  } = context;

  const getCacheKey = useCallback(
    (
      page: number,
      limit: number,
      search: string,
      filterActiveOnly: boolean
    ): string => {
      return `customers_${page}_${limit}_${search}_${filterActiveOnly}`;
    },
    []
  );

  const fetchCustomers = useCallback(
    async (options: FetchPartiesOptions) => {
      const {
        page = 1,
        limit = ITEMS_PER_PAGE,
        search = "",
        filterActiveOnly = true,
        append = false,
      } = options;

      const cacheKey = getCacheKey(page, limit, search, filterActiveOnly);

      // Check if we already have this data cached (for first page, non-search queries)
      if (page === 1 && !search && cache.current[cacheKey]) {
        setCustomers(cache.current[cacheKey]);
        setHasMore(true);
        return;
      }

      try {
        if (page === 1) setLoading(true);
        else setLoadingMore(true);

        const url = new URL("/api/customers", window.location.origin);
        url.searchParams.append("page", page.toString());
        url.searchParams.append("limit", limit.toString());
        if (search) url.searchParams.append("search", search);
        if (filterActiveOnly) url.searchParams.append("status", "active");

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error("Failed to fetch customers");
        const data = await response.json();

        const fetchedCustomers = data.customers || [];
        const filteredData = fetchedCustomers.filter(
          (party: Party) => party.is_delete !== 1
        );

        // Cache the result
        if (page === 1) {
          cache.current[cacheKey] = filteredData;
        }

        setCustomers((prev) =>
          append ? [...prev, ...filteredData] : filteredData
        );
        setHasMore(fetchedCustomers.length === limit);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Error fetching customers";
        setError(errorMessage);
        console.error("Error fetching customers:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [cache, getCacheKey, setCustomers, setLoading, setLoadingMore, setHasMore, setError]
  );

  const revalidate = useCallback(async () => {
    // Clear cache on revalidation
    cache.current = {};
    await fetchCustomers({ page: 1, limit: ITEMS_PER_PAGE, append: false });
  }, [cache, fetchCustomers]);

  return {
    customers,
    loading,
    loadingMore,
    hasMore,
    error,
    fetchCustomers,
    revalidate,
  };
}
