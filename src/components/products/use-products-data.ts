"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/offline-db";
import type { Product } from "./products-table";
import { useState, useEffect } from "react";

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

export function useProductsData({
  filters,
  priceRanges,
  page,
  limit,
  search,
}: UseProductsDataProps) {
  const [internalProducts, setInternalProducts] = useState<Product[]>([]);

  // We use useLiveQuery to fetch and filter all matching products
  const liveProducts = useLiveQuery(() => {
    return db.products.filter(product => {
      let matches = true;
      if (search) {
        const s = search.toLowerCase();
        matches = matches && Boolean(
          product.name?.toLowerCase().includes(s) ||
          product.sku?.toLowerCase().includes(s) ||
          product.description?.toLowerCase().includes(s)
        );
      }
      if (filters.type !== "all") matches = matches && product.type === filters.type;
      if (filters.category !== "all") matches = matches && product.category === filters.category;
      if (filters.branch !== "all") matches = matches && product.branch === filters.branch;
      
      if (priceRanges.sellPriceMin) matches = matches && Number(product.sell_price) >= Number(priceRanges.sellPriceMin);
      if (priceRanges.sellPriceMax) matches = matches && Number(product.sell_price) <= Number(priceRanges.sellPriceMax);
      if (priceRanges.costPriceMin) matches = matches && Number(product.cost_price) >= Number(priceRanges.costPriceMin);
      if (priceRanges.costPriceMax) matches = matches && Number(product.cost_price) <= Number(priceRanges.costPriceMax);
      
      return matches;
    }).toArray().then(arr => arr.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    }));
  }, [filters, priceRanges, search]);

  useEffect(() => {
    if (liveProducts) {
      setInternalProducts(liveProducts as Product[]);
    }
  }, [liveProducts]);

  const totalCount = internalProducts.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const startIndex = (page - 1) * limit;
  
  // if limit is -1, return all (for export/download)
  const paginatedProducts = limit === -1 ? internalProducts : internalProducts.slice(startIndex, startIndex + limit);

  return {
    products: paginatedProducts,
    setProducts: setInternalProducts, // Support optimistic updates
    loading: liveProducts === undefined,
    totalCount,
    totalPages,
    refetchData: async () => {}, // No-op since Dexie is reactive
  };
}

const defaultCategories = [
  "General",
  "Electronics",
  "Clothing",
  "Books",
  "Home",
  "Consulting",
  "Maintenance",
  "Delivery",
  "Installation",
];

export function useCategories() {
  const cats = useLiveQuery(() => db.categories.toArray());
  const categories = cats 
    ? Array.from(new Set([...defaultCategories, ...cats.map(c => c.name)]))
    : defaultCategories;
  return { categories };
}

export function useBranches() {
  const br = useLiveQuery(() => db.branches.toArray());
  const branches = br ? ["Main", ...br.map(b => b.name).filter(n => n !== "Main")] : ["Main"];
  return { branches };
}

