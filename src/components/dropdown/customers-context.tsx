"use client";

import React, { createContext, useState, useRef, ReactNode } from "react";

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

interface CustomersContextType {
  customers: Party[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  setCustomers: (customers: Party[] | ((prev: Party[]) => Party[])) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setError: (error: string | null) => void;
  cache: React.MutableRefObject<Record<string, Party[]>>;
}

export const CustomersContext = createContext<CustomersContextType | undefined>(
  undefined
);

interface CustomersProviderProps {
  children: ReactNode;
}

export function CustomersProvider({ children }: CustomersProviderProps) {
  const [customers, setCustomers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Record<string, Party[]>>({});

  const value: CustomersContextType = {
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
  };

  return (
    <CustomersContext.Provider value={value}>
      {children}
    </CustomersContext.Provider>
  );
}
