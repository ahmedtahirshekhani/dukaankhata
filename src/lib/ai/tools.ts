// @ts-nocheck
import { z } from "zod";
import { tool } from "ai";
import { NextRequest } from "next/server";

// Import the REST API handlers directly
import { GET as getCustomersApi, POST as createCustomerApi } from "@/app/[locale]/api/customers/route";
import { GET as getCustomerByIdApi, PUT as updateCustomerApi, DELETE as deleteCustomerApi } from "@/app/[locale]/api/customers/[customerId]/route";
import { GET as getTransactionsApi, POST as createTransactionApi } from "@/app/[locale]/api/customer-transactions/route";
import { DELETE as deleteTransactionApi } from "@/app/[locale]/api/customer-transactions/[id]/route";
import { GET as getProductsApi, POST as createProductApi } from "@/app/[locale]/api/products/route";
import { GET as getProductByIdApi, PUT as updateProductApi, DELETE as deleteProductApi } from "@/app/[locale]/api/products/[productId]/route";
import { GET as getOrdersApi } from "@/app/[locale]/api/orders/route";
import { GET as getExpensesApi } from "@/app/[locale]/api/expenses/route";
import { GET as getQuotationsApi } from "@/app/[locale]/api/quotations/route";
import { GET as getPurchaseBillsApi } from "@/app/[locale]/api/purchase-bills/route";
import { GET as getStockReportApi } from "@/app/[locale]/api/reports/stock/route";
import { GET as getProfitabilityReportApi } from "@/app/[locale]/api/reports/profitability/route";
import { GET as getReceivableSummaryReportApi } from "@/app/[locale]/api/reports/receivable-summary/route";
import { GET as getAccountStatementApi } from "@/app/[locale]/api/account-statement/route";

// Helper function to allow using relative URLs like frontend
const apiRequest = (path: string, options?: RequestInit) => {
  return new NextRequest(`http://internal${path}`, options as any);
};

// List-fetching tools used to default to limit=-1 ("fetch all records"),
// which let a single tool call return thousands of rows and blow past the
// model's context window. Every list tool now clamps to this cap; totalCount
// in each response still reflects the true total, so count-style questions
// aren't affected — only full listings are capped. Use `search`/filters to
// narrow results instead of raising the limit.
const MAX_TOOL_FETCH_LIMIT = 30;
const clampLimit = (limit?: number) => {
  if (!limit || limit <= 0 || limit > MAX_TOOL_FETCH_LIMIT) return MAX_TOOL_FETCH_LIMIT;
  return limit;
};

// Safe number parser to handle cases where LLM passes strings with units/currencies (e.g. "900/Piece", "Rs. 500")
const parseSafeNumber = (val: any, fallback = 0) => {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^0-9.-]+/g, ''));
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
};

// Helper to resolve an ID if the LLM mistakenly passes a name instead of an ObjectId
const resolveIdFromName = async (
  idOrName: string,
  apiEndpoint: string,
  apiMethod: Function,
  itemsKey: string
) => {
  if (!idOrName) return null;
  if (/^[0-9a-fA-F]{24}$/.test(idOrName)) return idOrName;
  try {
    const searchReq = apiRequest(`${apiEndpoint}?search=${encodeURIComponent(idOrName)}&limit=10`);
    const searchRes = await apiMethod(searchReq as any);
    const searchData = await searchRes.json();
    if (searchData && searchData[itemsKey]) {
      const match = searchData[itemsKey].find(
        (item: any) => item.name?.toLowerCase() === idOrName.toLowerCase()
      );
      if (match && match.id) return match.id;
    }
  } catch (e) {
    console.error("resolveIdFromName error:", e);
  }
  return null;
};

export const appTools = (userId: string) => ({
    getCustomers: tool({
      description: `Get a list of customers/parties for the user. Returns at most ${MAX_TOOL_FETCH_LIMIT} records per call (most recent first); use 'search' to narrow results. The response's totalCount field reflects the true total regardless of this limit, so use it for count questions.`,
      parameters: z.object({
        search: z.string().optional().describe("Optional search query to filter customers by name, phone, or company."),
        limit: z.number().optional().describe(`Number of records to fetch, max ${MAX_TOOL_FETCH_LIMIT}.`),
        page: z.number().optional().describe("Page number for pagination. Default is 1.")
      }),
      execute: async ({ search, limit, page }: any) => {
        try {
          let path = `/api/customers?`;
          if (search) path += `search=${encodeURIComponent(search)}&`;
          path += `limit=${clampLimit(limit)}&`;
          if (page !== undefined) path += `page=${page}&`;
          
          const req = apiRequest(path);
          const res = await getCustomersApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getCustomerById: tool({
      description: "Get a specific customer by their ID.",
      parameters: z.object({
        customerId: z.string().describe("The exact ID of the customer"),
      }),
      execute: async ({ customerId }: any) => {
        try {
          const req = apiRequest(`/api/customers/${customerId}`);
          const res = await getCustomerByIdApi(req, { params: { customerId } });
          const data = await res.json();
          if (!res.ok) return { error: data.error || "Customer not found" };
          return data;
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    createCustomer: tool({
      description: "Create a new customer/party.",
      parameters: z.object({
        name: z.string().describe("The name of the customer/party"),
        phone: z.string().optional().describe("The phone number of the customer. Leave empty if user says 'no phone' or 'phone nahi'."),
        company_name: z.string().optional().describe("The company/business name of the customer. This is DIFFERENT from company_address. Extract from: 'company ka naam', 'dukaan ka naam', 'company name'."),
        company_address: z.string().optional().describe("The physical address of the company/customer. This is DIFFERENT from company_name. Extract from: 'address', 'ghar ka pata', 'location'."),
        opening_balance: z.union([z.string(), z.number()]).optional().describe("The opening balance of the customer. Positive means they owe you money, negative means you owe them. Pass only the number."),
      }),
      execute: async (body: any) => {
        try {
          const payload = {
            name: String(body.name || 'Unnamed Customer').trim(),
            phone: body.phone || '',
            company_name: body.company_name || '',
            company_address: body.company_address || '',
            opening_balance: parseSafeNumber(body.opening_balance ?? body.balance ?? 0),
          };

          const req = apiRequest(`/api/customers`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          const res = await createCustomerApi(req);
          const data = await res.json();
          if (!res.ok) return { error: data.error || "Failed to create customer" };
          return { success: true, message: `Customer ${body.name} created successfully.`, data };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    updateCustomer: tool({
      description: "Update an existing customer/party's details.",
      parameters: z.object({
        customerId: z.string().describe("The ID or exact name of the customer to update"),
        name: z.string().optional().describe("The updated full name of the customer"),
        phone: z.string().optional().describe("The updated phone number"),
        company_name: z.string().optional().describe("The company/business NAME of the customer. IMPORTANT: This is the company's name (e.g. 'ATF', 'ABC Traders'). It is DIFFERENT from company_address which is a physical location. Use this when user says 'company ka naam change karo' or 'company ATF karo'."),
        company_address: z.string().optional().describe("The physical address or location of the company. DIFFERENT from company_name. Use this when user says 'address change karo' or 'location update karo'."),
        balance: z.union([z.string(), z.number()]).optional().describe("The updated balance amount (number only)"),
      }),
      execute: async ({ customerId, balance, opening_balance, ...body }: any) => {
        try {
          const finalId = await resolveIdFromName(customerId, "/api/customers", getCustomersApi, "customers");
          if (!finalId) return { error: `Could not find a valid customer ID for "${customerId}".` };

          if (balance !== undefined || opening_balance !== undefined) {
             body.balance = parseSafeNumber(balance ?? opening_balance);
          }
          const req = apiRequest(`/api/customers/${finalId}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          });
          const res = await updateCustomerApi(req, { params: { customerId: finalId } });
          const data = await res.json();
          if (!res.ok) return { error: data.error || "Failed to update customer" };
          return { success: true, message: `Customer updated successfully.`, data };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    deleteCustomer: tool({
      description: "Delete a customer/party by their exact Name.",
      parameters: z.object({
        name: z.string().describe("The exact name of the customer to delete"),
      }),
      execute: async ({ name }: { name: string }) => {
        try {
          // First search for the customer by name to get their ID
          const searchReq = apiRequest(`/api/customers?search=${encodeURIComponent(name)}`);
          const searchRes = await getCustomersApi(searchReq);
          const searchData = await searchRes.json();
          
          if (!searchData.customers || searchData.customers.length === 0) {
            return { error: `Customer with name ${name} not found.` };
          }
          
          const customerId = searchData.customers[0].id;
          
          const req = apiRequest(`/api/customers/${customerId}`, {
            method: 'DELETE',
          });
          const res = await deleteCustomerApi(req, { params: { customerId } });
          const data = await res.json();
          
          if (!res.ok) return { error: data.error || "Failed to delete customer" };
          return { success: true, message: `Customer ${name} deleted successfully.` };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getCustomerTransactions: tool({
      description: `Get a list of transactions (both payments-in from customers and payments-out to vendors/parties). Can be filtered by transaction type and specific name/id. Returns at most ${MAX_TOOL_FETCH_LIMIT} records per call, most recent first.`,
      parameters: z.object({
        type: z.enum(['payment-in', 'payment-out']).optional().describe("Filter by transaction type"),
        customerName: z.string().optional().describe("Optional name of the customer to filter transactions for"),
        customerId: z.string().optional().describe("Optional ID of the customer to filter transactions for"),
        limit: z.number().optional().describe(`Number of records to fetch, max ${MAX_TOOL_FETCH_LIMIT}.`),
      }),
      execute: async ({ type, customerName, customerId, limit }: any) => {
        try {
          let path = `/api/customer-transactions?limit=${clampLimit(limit)}`;
          if (type) path += `&type=${type}`;
          
          const req = apiRequest(path);
          const res = await getTransactionsApi(req);
          const data = await res.json();
          
          if (!data.transactions) return data;
          
          let filtered = data.transactions;
          if (customerId) {
            filtered = filtered.filter((t: any) => t.customerId === customerId);
          } else if (customerName) {
            filtered = filtered.filter((t: any) => 
              t.customerName && t.customerName.toLowerCase().includes(customerName.toLowerCase())
            );
          }
          
          return { ...data, transactions: filtered, totalCount: filtered.length };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    createCustomerTransaction: tool({
      description: "Create a new customer transaction (payment received or given).",
      parameters: z.object({
        customerId: z.string().describe("The ID or exact name of the customer"),
        paymentAmount: z.union([z.string(), z.number()]).optional().describe("The amount of the payment (number only)"),
        amount: z.union([z.string(), z.number()]).optional().describe("The amount of the payment (number only)"),
        paymentMethodId: z.string().describe("The ID of the payment method (or 'cash', 'cheque')"),
        type: z.string().describe("Type of transaction ('payment-in' or 'payment-out')"),
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
      }).passthrough(),
      execute: async ({ customerId, paymentAmount, type, ...rest }: any) => {
        try {
          const finalAmount = paymentAmount ?? rest.amount;
          const finalType = (type || 'payment-in').toLowerCase().replace('_', '-');
          const finalId = await resolveIdFromName(customerId, "/api/customers", getCustomersApi, "customers");
          if (!finalId) return { error: `Could not find a valid customer ID for "${customerId}".` };

          const body = {
            ...rest,
            customerId: finalId,
            type: finalType,
            paymentAmount: parseSafeNumber(finalAmount),
          };
          if (body.paymentMethodId && typeof body.paymentMethodId === 'string') {
            body.paymentMethodId = body.paymentMethodId.toLowerCase();
          }
          const req = apiRequest(`/api/customer-transactions`, {
            method: 'POST',
            body: JSON.stringify(body),
          });
          const res = await createTransactionApi(req);
          const data = await res.json();
          if (!res.ok) return { error: data.error || "Failed to create transaction" };
          return { success: true, message: `Transaction created successfully.`, data };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    deleteCustomerTransaction: tool({
      description: "Delete a customer transaction by its ID.",
      parameters: z.object({
        id: z.string().describe("The ID of the transaction to delete"),
      }),
      execute: async ({ id }: any) => {
        try {
          const req = apiRequest(`/api/customer-transactions/${id}`, {
            method: 'DELETE',
          });
          const res = await deleteTransactionApi(req, { params: { id } });
          const data = await res.json();
          if (!res.ok) return { error: data.error || "Failed to delete transaction" };
          return { success: true, message: `Transaction deleted successfully.` };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getProducts: tool({
      description: `Get a list of products. Can be searched by name or SKU. Returns at most ${MAX_TOOL_FETCH_LIMIT} records per call (most recent first); use 'search' to narrow results. The response's totalCount field reflects the true total regardless of this limit, so use it for count questions.`,
      parameters: z.object({
        search: z.string().optional().describe("Search term for product name or SKU"),
        type: z.enum(['goods', 'services', 'all']).optional().describe("Filter by product type"),
        limit: z.number().optional().describe(`Number of records to fetch, max ${MAX_TOOL_FETCH_LIMIT}.`),
        page: z.number().optional().describe("Page number for pagination. Default is 1.")
      }),
      execute: async ({ search, type, limit, page }: any) => {
        try {
          let path = `/api/products?`;
          if (search) path += `search=${encodeURIComponent(search)}&`;
          if (type && type !== 'all') path += `type=${type}&`;
          path += `limit=${clampLimit(limit)}&`;
          if (page !== undefined) path += `page=${page}&`;
          
          const req = apiRequest(path);
          const res = await getProductsApi(req);
          const data = await res.json();
          return data;
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getProductById: tool({
      description: "Get a specific product by its ID.",
      parameters: z.object({
        productId: z.string().describe("The exact ID of the product"),
      }),
      execute: async ({ productId }: any) => {
        try {
          const req = apiRequest(`/api/products/${productId}`);
          const res = await getProductByIdApi(req, { params: { productId } });
          const data = await res.json();
          if (!res.ok) return { error: data.error || "Product not found" };
          return data;
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    createProduct: tool({
      description: "Create a new product or service. IMPORTANT RULE: Before calling this tool, you MUST ask the user for all relevant details if they haven't provided them. This includes: name, type (goods/services), selling price, cost price, quantity in stock, category, unit of measurement, and branch. Do not make up values for these. If the user explicitly says they don't know or want to skip, you can proceed with defaults.",
      parameters: z.object({
        name: z.union([z.string(), z.number()]).optional().describe("The name of the product"),
        type: z.union([z.string(), z.number()]).optional().describe("The type of product (goods or services)"),
        sell_price: z.union([z.string(), z.number()]).optional().describe("The selling price of the product (number only)"),
        cost_price: z.union([z.string(), z.number()]).optional().describe("The cost price of the product (number only)"),
        sku: z.union([z.string(), z.number()]).optional().describe("The SKU or barcode of the product"),
        quantity: z.union([z.string(), z.number()]).optional().describe("Current stock quantity (number only)"),
        category: z.union([z.string(), z.number()]).optional().describe("Product category"),
        unit_of_measurement: z.union([z.string(), z.number()]).optional().describe("Unit of measurement (e.g. piece, kg, liter, gram, meter, box, pack, dozen)"),
        branch: z.union([z.string(), z.number()]).optional().describe("Branch name (e.g. Main)"),
        description: z.union([z.string(), z.number()]).optional().describe("Product description"),
      }).passthrough(),
      execute: async (body: any) => {
        try {
          // Strictly map the payload to ensure consistent DB schema
          const payload = {
            type: body.type || 'goods',
            name: String(body.name || body.product_name || 'Unnamed Product').trim(),
            description: body.description || '',
            category: body.category || 'General',
            sell_price: parseSafeNumber(body.sell_price ?? body.price ?? body.selling_price_pkr ?? body.selling_price ?? 0),
            cost_price: parseSafeNumber(body.cost_price ?? body.cost_price_pkr ?? 0),
            quantity: parseSafeNumber(body.quantity ?? body.stock ?? body.quantity_in_stock ?? 0),
            unit_of_measurement: body.unit_of_measurement ?? body.unit ?? 'piece',
            branch: body.branch || 'Main',
            sku: body.sku || '',
          };

          // Skip empty hallucinated extra calls (sometimes LLM calls it again with empty name)
          if (!payload.name || payload.name === 'Unnamed Product') {
             return { success: false, message: 'Skipped invalid product creation (name missing).' };
          }

          const req = apiRequest(`/api/products`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          const res = await createProductApi(req);
          const data = await res.json();
          if (!res.ok) return { error: data.error || "Failed to create product" };
          return { success: true, message: `Product created successfully.`, data };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    updateProduct: tool({
      description: "Update an existing product.",
      parameters: z.object({
        productId: z.string().describe("The ID or exact name of the product to update"),
        name: z.string().optional(),
        sell_price: z.union([z.string(), z.number()]).optional(),
        cost_price: z.union([z.string(), z.number()]).optional(),
        quantity: z.union([z.string(), z.number()]).optional(),
        category: z.string().optional(),
        unit_of_measurement: z.string().optional(),
        branch: z.string().optional(),
      }),
      execute: async ({ productId, sell_price, cost_price, quantity, ...body }: any) => {
        try {
          const finalId = await resolveIdFromName(productId, "/api/products", getProductsApi, "products");
          if (!finalId) return { error: `Could not find a valid product ID for "${productId}".` };

          const newQuantity = quantity ?? body.stock ?? body.quantity_in_stock;
          if (newQuantity !== undefined) {
             body.quantity = parseSafeNumber(newQuantity);
             delete body.stock;
             delete body.quantity_in_stock;
          }
          
          const newSellPrice = sell_price ?? body.price ?? body.selling_price ?? body.selling_price_pkr;
          if (newSellPrice !== undefined) {
             body.sell_price = parseSafeNumber(newSellPrice);
             delete body.price;
             delete body.selling_price;
             delete body.selling_price_pkr;
          }
          
          const newCostPrice = cost_price ?? body.cost_price_pkr;
          if (newCostPrice !== undefined) {
             body.cost_price = parseSafeNumber(newCostPrice);
             delete body.cost_price_pkr;
          }

          const req = apiRequest(`/api/products/${finalId}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          });
          const res = await updateProductApi(req, { params: { productId: finalId } });
          const data = await res.json();
          if (!res.ok) return { error: data.error || "Failed to update product" };
          return { success: true, message: `Product updated successfully.`, data };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    deleteProduct: tool({
      description: "Delete a product by exact name.",
      parameters: z.object({
        name: z.string().describe("The exact name of the product to delete"),
      }),
      execute: async ({ name }: { name: string }) => {
        try {
          // Search first to get ID
          const searchReq = apiRequest(`/api/products?search=${encodeURIComponent(name)}`);
          const searchRes = await getProductsApi(searchReq);
          const searchData = await searchRes.json();
          
          if (!searchData.products || searchData.products.length === 0) {
            return { error: `Product with name "${name}" not found.` };
          }
          
          const productId = searchData.products[0].id;
          
          const req = apiRequest(`/api/products/${productId}`, {
            method: 'DELETE',
          });
          const res = await deleteProductApi(req, { params: { productId } });
          const data = await res.json();
          if (!res.ok) return { error: data.error || "Failed to delete product" };
          return { success: true, message: `Product ${name} deleted successfully.` };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getOrders: tool({
      description: `Get a list of sales orders. Useful to check today's sales, best-selling products, or order history. Returns at most ${MAX_TOOL_FETCH_LIMIT} records per call (most recent first). The response's totalCount field reflects the true total regardless of this limit, so use it for count/sum questions.`,
      parameters: z.object({
        limit: z.number().optional().describe(`Number of records to fetch, max ${MAX_TOOL_FETCH_LIMIT}.`)
      }),
      execute: async ({ limit }: any) => {
        try {
          const req = apiRequest(`/api/orders?limit=${clampLimit(limit)}`);
          const res = await getOrdersApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getExpenses: tool({
      description: `Get a list of shop expenses. Returns at most ${MAX_TOOL_FETCH_LIMIT} records per call (most recent first). The response's totalCount field reflects the true total regardless of this limit, so use it for count/sum questions.`,
      parameters: z.object({
        limit: z.number().optional().describe(`Number of records to fetch, max ${MAX_TOOL_FETCH_LIMIT}.`)
      }),
      execute: async ({ limit }: any) => {
        try {
          const req = apiRequest(`/api/expenses?limit=${clampLimit(limit)}`);
          const res = await getExpensesApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getQuotations: tool({
      description: `Get a list of quotations. Returns at most ${MAX_TOOL_FETCH_LIMIT} records per call (most recent first). The response's pagination.totalItems field reflects the true total regardless of this limit, so use it for count questions.`,
      parameters: z.object({
        limit: z.number().optional().describe(`Number of records to fetch, max ${MAX_TOOL_FETCH_LIMIT}.`)
      }),
      execute: async ({ limit }: any) => {
        try {
          const req = apiRequest(`/api/quotations?limit=${clampLimit(limit)}`);
          const res = await getQuotationsApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getPurchaseBills: tool({
      description: `Get a list of purchase bills. Returns at most ${MAX_TOOL_FETCH_LIMIT} records per call (most recent first). The response's pagination.total field reflects the true total regardless of this limit, so use it for count questions.`,
      parameters: z.object({
        limit: z.number().optional().describe(`Number of records to fetch, max ${MAX_TOOL_FETCH_LIMIT}.`)
      }),
      execute: async ({ limit }: any) => {
        try {
          const req = apiRequest(`/api/purchase-bills?limit=${clampLimit(limit)}`);
          const res = await getPurchaseBillsApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getStockReport: tool({
      description: "Get the shop's stock report, low stock items, and total stock valuation.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const req = apiRequest(`/api/reports/stock`);
          const res = await getStockReportApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getProfitabilityReport: tool({
      description: "Get the shop's profitability report, showing revenue, cost, profit margins, and net profit.",
      parameters: z.object({
        startDate: z.string().optional().describe("Start date for the report in YYYY-MM-DD format."),
        endDate: z.string().optional().describe("End date for the report in YYYY-MM-DD format.")
      }),
      execute: async ({ startDate, endDate }: any) => {
        try {
          let url = `/api/reports/profitability`;
          if (startDate || endDate) {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            url += `?${params.toString()}`;
          }
          const req = apiRequest(url);
          const res = await getProfitabilityReportApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getReceivableSummaryReport: tool({
      description: "Get the shop's receivable and payable summary, showing total amount customers owe you, and total amount you owe to vendors.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const req = apiRequest(`/api/reports/receivable-summary`);
          const res = await getReceivableSummaryReportApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    getAccountStatement: tool({
      description: "Get the account statement / ledger for a specific customer. Must provide customerId. fromDate and toDate are optional (defaults to last 30 days).",
      parameters: z.object({
        customerId: z.string().describe("The ID of the customer."),
        fromDate: z.string().optional().describe("Start date for the statement in YYYY-MM-DD format."),
        toDate: z.string().optional().describe("End date for the statement in YYYY-MM-DD format.")
      }),
      execute: async ({ customerId, fromDate, toDate }: any) => {
        try {
          let fDate = fromDate;
          let tDate = toDate;
          if (!fDate || !tDate) {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 30);
            tDate = end.toISOString().split('T')[0];
            fDate = start.toISOString().split('T')[0];
          }
          const params = new URLSearchParams({ customerId, fromDate: fDate, toDate: tDate });
          const req = apiRequest(`/api/account-statement?${params.toString()}`);
          const res = await getAccountStatementApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),
});
