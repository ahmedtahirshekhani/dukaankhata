"use client";

import { useState, useEffect, useCallback } from "react";
import type { Product } from "./products-table";

interface UseProductsDataResult {
  products: Product[];
  categories: string[];
  branches: string[];
  loading: boolean;
  totalCount: number;
  totalPages: number;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  refetchData: (page?: number, search?: string, limit?: number) => Promise<void>;
}

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

export function useProductsData({ filters, priceRanges, page, limit, search }: UseProductsDataProps): UseProductsDataResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (overridePage?: number, overrideSearch?: string, overrideLimit?: number) => {
    try {
      setLoading(true);
      const currentPage = overridePage ?? page;
      const currentSearch = overrideSearch ?? search;
      const currentLimit = overrideLimit ?? limit;

      // Fetch products with all filters
      const url = new URL("/api/products", window.location.origin);
      url.searchParams.append("page", currentPage.toString());
      url.searchParams.append("limit", currentLimit.toString());
      if (currentSearch) {
        url.searchParams.append("search", currentSearch);
      }
      
      if (filters.type !== "all") {
        url.searchParams.append("type", filters.type);
      }
      if (filters.category !== "all") {
        url.searchParams.append("category", filters.category);
      }
      if (filters.branch !== "all") {
        url.searchParams.append("branch", filters.branch);
      }
      if (priceRanges.sellPriceMin) {
        url.searchParams.append("sellPriceMin", priceRanges.sellPriceMin);
      }
      if (priceRanges.sellPriceMax) {
        url.searchParams.append("sellPriceMax", priceRanges.sellPriceMax);
      }
      if (priceRanges.costPriceMin) {
        url.searchParams.append("costPriceMin", priceRanges.costPriceMin);
      }
      if (priceRanges.costPriceMax) {
        url.searchParams.append("costPriceMax", priceRanges.costPriceMax);
      }
      
      const productsResponse = await fetch(url.toString());
      if (!productsResponse.ok) {
        throw new Error("Failed to fetch products");
      }
      const productsData = await productsResponse.json();
      setProducts(productsData.products);
      setTotalCount(productsData.totalCount);
      setTotalPages(productsData.totalPages);

      // Fetch categories from database
      const categoriesResponse = await fetch("/api/categories");
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        const dbCategories = categoriesData.map((c: any) => c.name);
        const allCategories = dbCategories.includes("General")
          ? dbCategories
          : ["General", ...dbCategories];
        setCategories(allCategories);
      } else {
        setCategories(["General"]);
      }

      // Fetch branches from database
      const branchesResponse = await fetch("/api/branches");
      if (branchesResponse.ok) {
        const branchesData = await branchesResponse.json();
        const dbBranches = branchesData.map((b: any) => b.name);
        const allBranches = dbBranches.includes("Main")
          ? dbBranches
          : ["Main", ...dbBranches];
        setBranches(allBranches);
      } else {
        setBranches(["Main"]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
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
    fetchData();
  }, [fetchData]);

  return {
    products,
    categories,
    branches,
    loading,
    totalCount,
    totalPages,
    setProducts,
    refetchData: fetchData,
  };
}
