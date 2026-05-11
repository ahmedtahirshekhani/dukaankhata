"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Product } from "./products-table";

// Simple in-memory cache to avoid duplicate fetches in dev (Strict Mode)
let categoriesCache: string[] | null = null;
let categoriesPromise: Promise<string[]> | null = null;

let branchesCache: string[] | null = null;
let branchesPromise: Promise<string[]> | null = null;

interface UseProductsDataProps {
  filters: {
    type: string;
    category: string;
    branch: string;
  };
  priceRanges: {
    sellPriceMin: string;
    sellPriceMax: string;
    costPriceMin: string;
    costPriceMax: string;
  };
  page: number;
  limit: number;
  search: string;
}

interface UseProductsDataResult {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  loading: boolean;
  totalCount: number;
  totalPages: number;
  refetchData: () => Promise<void>;
}

export function useProductsData({
  filters,
  priceRanges,
  page,
  limit,
  search,
}: UseProductsDataProps): UseProductsDataResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchProducts = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);

      // cancel previous request (IMPORTANT FIX)
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const url = new URL("/api/products", window.location.origin);

      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));

      if (search) url.searchParams.set("search", search);

      if (filters.type !== "all") url.searchParams.set("type", filters.type);
      if (filters.category !== "all") url.searchParams.set("category", filters.category);
      if (filters.branch !== "all") url.searchParams.set("branch", filters.branch);

      if (priceRanges.sellPriceMin)
        url.searchParams.set("sellPriceMin", priceRanges.sellPriceMin);

      if (priceRanges.sellPriceMax)
        url.searchParams.set("sellPriceMax", priceRanges.sellPriceMax);

      if (priceRanges.costPriceMin)
        url.searchParams.set("costPriceMin", priceRanges.costPriceMin);

      if (priceRanges.costPriceMax)
        url.searchParams.set("costPriceMax", priceRanges.costPriceMax);

      const res = await fetch(url.toString(), {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Failed to fetch products");

      const data = await res.json();

      setProducts(data.products);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      if (requestId === requestIdRef.current && err.name !== "AbortError") {
        console.error("Error fetching products:", err);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    page,
    limit,
    search,
    filters.type,
    filters.category,
    filters.branch,
    priceRanges.sellPriceMin,
    priceRanges.sellPriceMax,
    priceRanges.costPriceMin,
    priceRanges.costPriceMax,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    setProducts,
    loading,
    totalCount,
    totalPages,
    refetchData: fetchProducts,
  };
}

export function useCategories() {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    if (categoriesCache) {
      setCategories(categoriesCache);
      return () => {
        mounted = false;
      };
    }

    if (!categoriesPromise) {
      categoriesPromise = (async () => {
        const res = await fetch("/api/categories");
        if (!res.ok) throw new Error("Failed to fetch categories");
        const data = await res.json();

        const dbCategories = data.map((c: any) => c.name);
        const allCategories = dbCategories.includes("General")
          ? dbCategories
          : ["General", ...dbCategories];

        categoriesCache = allCategories;
        return allCategories;
      })();
    }

    categoriesPromise
      .then((all) => {
        if (mounted) setCategories(all);
      })
      .catch((err) => {
        if (mounted) setCategories(["General"]);
        console.error("Error fetching categories:", err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { categories };
}

export function useBranches() {
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    if (branchesCache) {
      setBranches(branchesCache);
      return () => {
        mounted = false;
      };
    }

    if (!branchesPromise) {
      branchesPromise = (async () => {
        const res = await fetch("/api/branches");
        if (!res.ok) throw new Error("Failed to fetch branches");
        const data = await res.json();

        const dbBranches = data.map((b: any) => b.name);
        const allBranches = dbBranches.includes("Main")
          ? dbBranches
          : ["Main", ...dbBranches];

        branchesCache = allBranches;
        return allBranches;
      })();
    }

    branchesPromise
      .then((all) => {
        if (mounted) setBranches(all);
      })
      .catch((err) => {
        if (mounted) setBranches(["Main"]);
        console.error("Error fetching branches:", err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { branches };
}
