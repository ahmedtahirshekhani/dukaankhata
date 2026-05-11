import { useCallback, useContext } from "react";
import { ProductsContext } from "@/components/dropdown/products-context";
import { Product } from "@/types/product";

interface FetchProductsOptions {
  page?: number;
  limit?: number;
  search?: string;
  append?: boolean;
}

interface UseProductsCacheReturn {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  fetchProducts: (options: FetchProductsOptions) => Promise<void>;
  fetchProductById: (productId: string | number) => Promise<void>;
  revalidate: () => Promise<void>;
}

const ITEMS_PER_PAGE = 20;

export function useProductsCache(): UseProductsCacheReturn {
  const context = useContext(ProductsContext);

  if (!context) {
    throw new Error("useProductsCache must be used within ProductsProvider");
  }

  const {
    products,
    loading,
    loadingMore,
    hasMore,
    error,
    setProducts,
    setLoading,
    setLoadingMore,
    setHasMore,
    setError,
    cache,
    inFlightRequests,
  } = context;

  const getCacheKey = useCallback((page: number, limit: number, search: string): string => {
    return `products_${page}_${limit}_${search}`;
  }, []);

  const fetchProducts = useCallback(
    async (options: FetchProductsOptions) => {
      const {
        page = 1,
        limit = ITEMS_PER_PAGE,
        search = "",
        append = false,
      } = options;

      const cacheKey = getCacheKey(page, limit, search);

      if (!append && cache.current[cacheKey]) {
        const cached = cache.current[cacheKey];
        setProducts(cached.products);
        setHasMore(cached.hasMore);
        return;
      }

      try {
        if (page === 1) setLoading(true);
        else setLoadingMore(true);

        let request = inFlightRequests.current[cacheKey];
        if (!request) {
          request = (async () => {
            const url = new URL("/api/products", window.location.origin);
            url.searchParams.append("page", page.toString());
            url.searchParams.append("limit", limit.toString());
            if (search) url.searchParams.append("search", search);

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error("Failed to fetch products");

            const data = await res.json();
            const fetchedProducts = data.products || [];

            return {
              products: fetchedProducts,
              hasMore: fetchedProducts.length === limit,
            };
          })();

          inFlightRequests.current[cacheKey] = request;
        }

        const result = await request;

        cache.current[cacheKey] = result;
        setProducts((prev) => (append ? [...prev, ...result.products] : result.products));
        setHasMore(result.hasMore);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error fetching products";
        setError(message);
        console.error("Error fetching products:", err);
      } finally {
        delete inFlightRequests.current[cacheKey];
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      cache,
      inFlightRequests,
      getCacheKey,
      setProducts,
      setHasMore,
      setError,
      setLoading,
      setLoadingMore,
    ]
  );

  const fetchProductById = useCallback(
    async (productId: string | number) => {
      if (!productId) return;

      const idAsString = String(productId);
      const exists = products.some((p) => String(p.id || p._id) === idAsString);
      if (exists) return;

      try {
        const res = await fetch(`/api/products/${idAsString}`);
        if (!res.ok) return;

        const product = await res.json();
        setProducts((prev) => {
          const alreadyThere = prev.some((p) => String(p.id || p._id) === idAsString);
          if (alreadyThere) return prev;
          return [product, ...prev];
        });
      } catch (err) {
        console.error("Error fetching selected product:", err);
      }
    },
    [products, setProducts]
  );

  const revalidate = useCallback(async () => {
    cache.current = {};
    inFlightRequests.current = {};
    await fetchProducts({ page: 1, limit: ITEMS_PER_PAGE, search: "", append: false });
  }, [cache, inFlightRequests, fetchProducts]);

  return {
    products,
    loading,
    loadingMore,
    hasMore,
    error,
    fetchProducts,
    fetchProductById,
    revalidate,
  };
}