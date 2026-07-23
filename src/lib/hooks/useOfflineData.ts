import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "../db/offline-db";

// Custom hook to replace useLiveQuery from dexie-react-hooks
// This fixes the Next.js App Router bug where navigating back returns an empty/stale state
function useSafeLiveQuery<T>(
  querier: () => Promise<T> | T,
  deps: any[] = [],
): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);

  useEffect(() => {
    // Standard Dexie liveQuery subscription
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (val) => setData(val),
      error: (err) => console.error("useSafeLiveQuery error:", err),
    });

    // Manual fetch fallback on window focus to ensure data is immediately retrieved
    const handleFocus = async () => {
      try {
        const result = await querier();
        setData(result);
      } catch (err) {
        console.error("useSafeLiveQuery focus fetch error:", err);
      }
    };
    
    // Also listen for initialSyncComplete from SyncEngine
    const handleSync = async () => {
      try {
        const result = await querier();
        setData(result);
      } catch (err) {}
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("initialSyncComplete", handleSync);
    window.addEventListener("syncComplete", handleSync);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("initialSyncComplete", handleSync);
      window.removeEventListener("syncComplete", handleSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}

export function useOfflineCustomers(searchQuery: string = "") {
  return useSafeLiveQuery(() => {
    return db.parties
      .filter((party) => {
        // Filter out deleted parties
        if (party.is_delete === 1) return false;

        if (searchQuery) {
          const lowerSearch = searchQuery.toLowerCase();
          return Boolean(
            party.name?.toLowerCase().includes(lowerSearch) ||
            party.phone?.includes(searchQuery) ||
            party.company_name?.toLowerCase().includes(lowerSearch),
          );
        }
        return true;
      })
      .toArray()
      .then((arr) =>
        arr.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }),
      );
  }, [searchQuery]);
}

export function useOfflineProducts(
  searchQuery: string = "",
  type: string = "all",
) {
  return useSafeLiveQuery(() => {
    let collection = db.products;

    return collection
      .filter((product) => {
        let matchesSearch = true;
        let matchesType = true;

        if (searchQuery) {
          const lowerSearch = searchQuery.toLowerCase();
          matchesSearch =
            product.name?.toLowerCase().includes(lowerSearch) ||
            product.sku?.toLowerCase().includes(lowerSearch) ||
            product.category?.toLowerCase().includes(lowerSearch);
        }

        if (type && type !== "all") {
          matchesType = product.type === type;
        }

        return matchesSearch && matchesType && product.is_delete !== 1;
      })
      .toArray()
      .then((arr) =>
        arr.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }),
      );
  }, [searchQuery, type]);
}

export function useOfflineCategories(searchQuery: string = "") {
  return useSafeLiveQuery(() => {
    return db.categories
      .filter((category) => {
        if (category.is_delete === 1) return false;
        if (searchQuery) {
          return Boolean(
            category.category_name
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()),
          );
        }
        return true;
      })
      .toArray()
      .then((arr) =>
        arr.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }),
      );
  }, [searchQuery]);
}

export function useOfflineOrders(
  searchQuery: string = "",
  statusFilter: string = "all",
) {
  return useSafeLiveQuery(async () => {
    const allOrders = await db.orders.orderBy("created_at").reverse().toArray();

    let filtered = allOrders;
    if (statusFilter !== "all") {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.invoice_no?.toLowerCase().includes(term) ||
          o.id?.toString().toLowerCase().includes(term),
      );
    }

    const withCustomers = await Promise.all(
      filtered.map(async (o) => {
        const customer = await db.parties.get(o.customer_id);
        return {
          ...o,
          customer: customer ? { name: customer.name } : null,
        };
      }),
    );

    return withCustomers;
  }, [searchQuery, statusFilter]);
}

export function useOfflineExpenses(searchQuery: string = "") {
  return useSafeLiveQuery(() => {
    return db.expenses.toArray().then((expenses) => {
      return expenses
        .map((e) => {
          let formattedDate = e.date;
          if (
            formattedDate &&
            typeof formattedDate === "string" &&
            formattedDate.includes("T")
          ) {
            formattedDate = formattedDate.split("T")[0];
          }
          return {
            ...e,
            expenseNumber: e.expenseNumber || e.expense_number || "-",
            itemName: e.itemName || e.item_name || "-",
            date: formattedDate,
          };
        })
        .filter((e) => {
          if (searchQuery) {
            const lowerSearch = searchQuery.toLowerCase();
            return Boolean(
              e.expenseNumber?.toLowerCase().includes(lowerSearch) ||
              e.category?.toLowerCase().includes(lowerSearch) ||
              e.itemName?.toLowerCase().includes(lowerSearch),
            );
          }
          return true;
        })
        .sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        });
    });
  }, [searchQuery]);
}

export function useOfflineLedger(partyId: string) {
  return useSafeLiveQuery(
    () => db.party_ledger_entries.where("party_id").equals(partyId).toArray(),
    [partyId],
  );
}

export function useOfflineCustomerTransactions(
  type: string = "payment-in",
  searchQuery: string = "",
  filterPaymentMethodId: string = "all",
  filterPartyId: string = "all",
) {
  return useSafeLiveQuery(async () => {
    // Join parties and payment methods locally
    const allParties = await db.parties.toArray();
    const partyMap = new Map(
      allParties.map((p) => [(p.id || p._id)?.toString(), p.name]),
    );

    const allMethods = await db.payment_methods.toArray();
    const methodMap = new Map(
      allMethods.map((m) => [
        (m.id || m._id)?.toString(),
        m.name || m.bankName || m.bank_name,
      ]),
    );

    const transactions = await db.party_transactions.toArray();

    return transactions
      .map((t) => {
        // Normalize snake_case (server) to camelCase (local/UI)
        const customerId = (t.customerId || t.customer_id)?.toString();
        const paymentMethodId = (
          t.paymentMethodId || t.payment_method_id
        )?.toString();
        const paymentAmount = t.paymentAmount ?? t.payment_amount ?? 0;
        let formattedDate = t.date;
        if (
          formattedDate &&
          typeof formattedDate === "string" &&
          formattedDate.includes("T")
        ) {
          formattedDate = formattedDate.split("T")[0];
        }

        return {
          ...t,
          id: t.id,
          customerId,
          paymentMethodId,
          paymentAmount,
          date: formattedDate,
          customerName: t.customerName || partyMap.get(customerId) || "-",
          paymentMethodName:
            t.paymentMethodName ||
            methodMap.get(paymentMethodId) ||
            (paymentMethodId === "cash"
              ? "Cash"
              : paymentMethodId === "cheque"
                ? "Cheque"
                : "-"),
        };
      })
      .filter((t) => {
        let matches = t.type === type;

        if (filterPaymentMethodId && filterPaymentMethodId !== "all") {
          matches = matches && t.paymentMethodId === filterPaymentMethodId;
        }

        if (filterPartyId && filterPartyId !== "all") {
          matches = matches && t.customerId === filterPartyId;
        }

        if (searchQuery) {
          const lowerSearch = searchQuery.toLowerCase();
          matches =
            matches &&
            ((t.customerName &&
              t.customerName.toLowerCase().includes(lowerSearch)) ||
              (t.paymentMethodName &&
                t.paymentMethodName.toLowerCase().includes(lowerSearch)) ||
              (t.paymentAmount &&
                t.paymentAmount.toString().includes(searchQuery)) ||
              (t.date && t.date.includes(searchQuery)));
        }

        return matches;
      })
      .sort((a, b) => {
        // Sort by date descending
        const dateA = a.date
          ? new Date(a.date).getTime()
          : a.created_at
            ? new Date(a.created_at).getTime()
            : 0;
        const dateB = b.date
          ? new Date(b.date).getTime()
          : b.created_at
            ? new Date(b.created_at).getTime()
            : 0;
        return dateB - dateA;
      });
  }, [type, searchQuery, filterPaymentMethodId, filterPartyId]);
}

export function useOfflinePaymentMethods() {
  return useSafeLiveQuery(() => db.payment_methods.toArray());
}

export function useOfflineQuotations(searchQuery: string = "") {
  return useSafeLiveQuery(() => {
    return db.quotations
      .filter((quotation) => {
        // Filter out deleted quotations if there's a flag, otherwise assume all are valid unless deleted physically
        if (quotation.is_delete === 1) return false;

        if (searchQuery) {
          const lowerSearch = searchQuery.toLowerCase();
          return Boolean(
            quotation.quotation_no?.toLowerCase().includes(lowerSearch) ||
            quotation.party_name?.toLowerCase().includes(lowerSearch),
          );
        }
        return true;
      })
      .toArray()
      .then((arr) =>
        arr.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }),
      );
  }, [searchQuery]);
}

export function useOfflineSaleReturns(
  searchQuery: string = "",
  filterPaymentMethodId: string = "all",
  filterPartyId: string = "all",
) {
  return useSafeLiveQuery(async () => {
    // Join parties and payment methods locally
    const allParties = await db.parties.toArray();
    const partyMap = new Map(
      allParties.map((p) => [(p.id || p._id)?.toString(), p.name]),
    );

    const allMethods = await db.payment_methods.toArray();
    const methodMap = new Map(
      allMethods.map((m) => [
        (m.id || m._id)?.toString(),
        m.name || m.bankName || m.bank_name,
      ]),
    );

    const transactions = await db.sale_return_transactions.toArray();

    return transactions
      .map((t) => {
        const customerId = (t.customerId || t.customer_id)?.toString();
        const paymentMethodId = (
          t.paymentMethodId || t.payment_method_id
        )?.toString();
        let formattedDate = t.date;
        if (
          formattedDate &&
          typeof formattedDate === "string" &&
          formattedDate.includes("T")
        ) {
          formattedDate = formattedDate.split("T")[0];
        }

        return {
          ...t,
          id: t.id,
          customerId,
          paymentMethodId,
          returnNumber: t.returnNumber || t.return_number || "-",
          totalAmount: t.totalAmount ?? t.total_amount ?? 0,
          paidAmount: t.paidAmount ?? t.paid_amount ?? 0,
          balanceDue: t.balanceDue ?? t.balance_due ?? 0,
          invoiceNo: t.invoiceNo || t.invoice_no || "",
          invoiceDate: t.invoiceDate || t.invoice_date || "",
          paymentRefNo: t.paymentRefNo || t.payment_ref_no || "",
          date: formattedDate,
          customerName: t.customerName || partyMap.get(customerId) || "-",
          paymentMethodName:
            t.paymentMethodName ||
            methodMap.get(paymentMethodId) ||
            (paymentMethodId === "cash"
              ? "Cash"
              : paymentMethodId === "cheque"
                ? "Cheque"
                : "-"),
        };
      })
      .filter((t) => {
        let matches = true;

        if (t.is_delete === 1) return false;

        if (filterPaymentMethodId && filterPaymentMethodId !== "all") {
          matches = matches && t.paymentMethodId === filterPaymentMethodId;
        }

        if (filterPartyId && filterPartyId !== "all") {
          matches = matches && t.customerId === filterPartyId;
        }

        if (searchQuery) {
          const lowerSearch = searchQuery.toLowerCase();
          matches =
            matches &&
            ((t.customerName &&
              t.customerName.toLowerCase().includes(lowerSearch)) ||
              (t.paymentMethodName &&
                t.paymentMethodName.toLowerCase().includes(lowerSearch)) ||
              (t.returnNumber &&
                t.returnNumber.toLowerCase().includes(lowerSearch)) ||
              (t.totalAmount &&
                t.totalAmount.toString().includes(searchQuery)) ||
              (t.date && t.date.includes(searchQuery)));
        }

        return matches;
      })
      .sort((a, b) => {
        // Sort by date descending
        const dateA = a.date
          ? new Date(a.date).getTime()
          : a.created_at
            ? new Date(a.created_at).getTime()
            : 0;
        const dateB = b.date
          ? new Date(b.date).getTime()
          : b.created_at
            ? new Date(b.created_at).getTime()
            : 0;
        return dateB - dateA;
      });
  }, [searchQuery, filterPaymentMethodId, filterPartyId]);
}

export function useOfflineCounterSales(
  searchQuery: string = "",
  filterType: string = "all",
  year?: number,
) {
  return useSafeLiveQuery(async () => {
    // Get all transactions
    let transactions = await db.transactions.toArray();

    // Filter by type
    if (filterType && filterType !== "all") {
      transactions = transactions.filter((t) => t.type === filterType);
    }

    // Filter by year
    if (year) {
      transactions = transactions.filter((t) => {
        if (!t.created_at) return false;
        const tYear = new Date(t.created_at).getFullYear();
        return tYear === year;
      });
    }

    // Filter by search query (productName)
    if (searchQuery) {
      const lowerSearch = searchQuery.toLowerCase();
      transactions = transactions.filter((t) => {
        return (
          (t.productName &&
            t.productName.toLowerCase().includes(lowerSearch)) ||
          (t.customerName && t.customerName.toLowerCase().includes(lowerSearch))
        );
      });
    }

    // Process transactions and join with products if needed
    const allProducts = await db.products.toArray();
    const productMap = new Map(
      allProducts.map((p) => [(p.id || p._id)?.toString(), p]),
    );

    return transactions
      .map((t) => {
        // Get product details if productId is present and not 0 (which is "others")
        const productId = (t.productId || t.product_id)?.toString();
        let productName = t.productName || t.product_name;
        let productDescription = t.productDescription || t.product_description;

        if (productId && productId !== "0") {
          const product = productMap.get(productId);
          if (product) {
            productName = productName || product.name;
            productDescription = productDescription || product.description;
          }
        }

        return {
          ...t,
          id: t.id || t._id,
          productId,
          productName: productName || "-",
          productDescription: productDescription || "-",
          created_at: t.created_at || t.date || new Date().toISOString(),
        };
      })
      .sort((a, b) => {
        // Sort by created_at descending
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
  }, [searchQuery, filterType, year]);
}

export function useOfflinePurchaseBills(searchQuery: string = "") {
  return useSafeLiveQuery(async () => {
    // Join parties locally if needed, but purchase_bills might already have party_name
    const allParties = await db.parties.toArray();
    const partyMap = new Map(
      allParties.map((p) => [(p.id || p._id)?.toString(), p.name]),
    );

    const bills = await db.purchase_bills.toArray();

    return bills
      .map((b) => {
        const partyId = (b.party_id || b.partyId)?.toString();

        return {
          ...b,
          id: b.id || b._id,
          party_name:
            b.party_name || b.partyName || partyMap.get(partyId) || "-",
          total_amount: b.total_amount ?? b.totalAmount ?? 0,
          paid_amount: b.paid_amount ?? b.paidAmount ?? 0,
          balance_due: b.balance_due ?? b.balanceDue ?? 0,
          is_paid: b.is_paid ?? b.isPaid ?? false,
        };
      })
      .filter((b) => {
        // Basic deletion filter
        if (b.is_delete === 1) return false;

        let matches = true;

        // Filter by search query (party_name or total_amount)
        if (searchQuery) {
          const lowerSearch = searchQuery.toLowerCase();
          matches =
            matches &&
            ((b.party_name &&
              b.party_name.toLowerCase().includes(lowerSearch)) ||
              (b.total_amount &&
                b.total_amount.toString().includes(searchQuery)));
        }

        return matches;
      })
      .sort((a, b) => {
        // Sort by created_at descending
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
  }, [searchQuery]);
}

export function useOfflineRoles(searchQuery: string = "") {
  return useSafeLiveQuery(async () => {
    const roles = await db.roles
      .filter((role) => {
        if (searchQuery) {
          const lowerSearch = searchQuery.toLowerCase();
          return Boolean(role.name?.toLowerCase().includes(lowerSearch));
        }
        return true;
      })
      .toArray();
      
    const rolePermissions = await db.role_permissions.toArray();
    const permissions = await db.permissions.toArray();

    return roles.map(role => {
      const roleId = role.id || role._id;
      let perms: string[] = [];

      // If permissions were saved directly to the role object offline
      if (role.permissions && Array.isArray(role.permissions)) {
        perms = role.permissions;
      } else {
        const myPerms = rolePermissions.filter(rp => 
          String(rp.role_id) === String(roleId) || String(rp.role_id) === String(role._id)
        );
        perms = myPerms.map(rp => {
          const p = permissions.find(ap => 
            String(ap.id) === String(rp.permission_id) || String(ap._id) === String(rp.permission_id)
          );
          return p ? `${p.module_code}.${p.action}` : null;
        }).filter(Boolean) as string[];
      }

      return {
        ...role,
        permissions: perms
      };
    });
  }, [searchQuery]);
}

export function useOfflineModules() {
  return useSafeLiveQuery(async () => {
    const modules = await db.modules.toArray();
    const permissions = await db.permissions.toArray();

    return modules.filter(mod => mod.isActive !== false).map(mod => {
      const actions = permissions
        .filter(p => p.module_code === mod.code && p.isActive !== false)
        .map(p => p.action);
        
      return {
        ...mod,
        actions
      };
    });
  });
}

export function useOfflinePermissions() {
  return useSafeLiveQuery(() => db.permissions.toArray());
}

export function useOfflineStaff(searchQuery: string = "") {
  return useSafeLiveQuery(async () => {
    const users = await db.users.toArray();
    const userRoles = await db.user_roles.toArray();
    const roles = await db.roles.toArray();

    // Map role names to users based on user_roles
    return users
      .filter(user => {
        // Must be staff (has a role mapping, or legacy role="staff")
        const myRoles = userRoles.filter(ur => (String(ur.user_id) === String(user.id) || String(ur.user_id) === String(user._id)));
        const isStaff = myRoles.length > 0 || user.role === "staff";
        if (!isStaff) return false;

        if (searchQuery) {
          const lowerSearch = searchQuery.toLowerCase();
          return Boolean(
            user.name?.toLowerCase().includes(lowerSearch) ||
            user.email?.toLowerCase().includes(lowerSearch) ||
            user.phone?.includes(searchQuery)
          );
        }
        return true;
      })
      .map(user => {
        // Find user role mappings
        const myRoles = userRoles.filter(ur => (String(ur.user_id) === String(user.id) || String(ur.user_id) === String(user._id)));
        const firstRoleMapping = myRoles[0];
        
        let roleName = "Unknown";
        let roleId = firstRoleMapping?.role_id || null;

        if (firstRoleMapping) {
          const roleObj = roles.find(r => (String(r.id) === String(firstRoleMapping.role_id) || String(r._id) === String(firstRoleMapping.role_id)));
          if (roleObj) {
            roleName = roleObj.name;
          }
        }
        
        return {
          ...user,
          role_id: roleId,
          role_name: roleName,
          roles: myRoles.map(ur => {
            const r = roles.find(r => (String(r.id) === String(ur.role_id) || String(r._id) === String(ur.role_id)));
            return r ? r.name : "Unknown";
          }),
          roleData: myRoles.map(ur => {
             const r = roles.find(rl => (String(rl.id) === String(ur.role_id) || String(rl._id) === String(ur.role_id)));
             return r || null;
          }).filter(Boolean)
        };
      });
  }, [searchQuery]);
}
