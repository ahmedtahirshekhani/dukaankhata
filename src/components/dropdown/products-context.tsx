"use client";

import React, { createContext, useRef, useState } from "react";
import { Product } from "@/types/product";

type ProductsCacheEntry = {
  products: Product[];
  hasMore: boolean;
};

interface ProductsContextType {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setError: (error: string | null) => void;
  cache: React.MutableRefObject<Record<string, ProductsCacheEntry>>;
  inFlightRequests: React.MutableRefObject<Record<string, Promise<ProductsCacheEntry>>>;
}

export const ProductsContext = createContext<ProductsContextType | undefined>(
  undefined
);

interface ProductsProviderProps {
  children: React.ReactNode;
}

export function ProductsProvider({ children }: ProductsProviderProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cache = useRef<Record<string, ProductsCacheEntry>>({});
  const inFlightRequests = useRef<Record<string, Promise<ProductsCacheEntry>>>({});

  return (
    <ProductsContext.Provider
      value={{
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
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}