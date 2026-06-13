import { z } from "zod";
import { tool } from "ai";
import { NextRequest } from "next/server";

// Import the REST API handlers directly
import { GET as getCustomersApi, POST as createCustomerApi } from "@/app/[locale]/api/customers/route";
import { PUT as updateCustomerApi, DELETE as deleteCustomerApi } from "@/app/[locale]/api/customers/[customerId]/route";
import { GET as getTransactionsApi, POST as createTransactionApi } from "@/app/[locale]/api/customer-transactions/route";
import { DELETE as deleteTransactionApi } from "@/app/[locale]/api/customer-transactions/[id]/route";
import { GET as getProductsApi, POST as createProductApi } from "@/app/[locale]/api/products/route";
import { PUT as updateProductApi, DELETE as deleteProductApi } from "@/app/[locale]/api/products/[productId]/route";

// Helper function to allow using relative URLs like frontend
const apiRequest = (path: string, options?: RequestInit) => {
  // Next.js NextRequest requires an absolute URL under the hood
  return new NextRequest(`http://internal${path}`, options);
};

export const appTools = (userId: string) => ({
    getCustomers: tool({
      description: "Get a list of all customers/parties for the user.",
      parameters: z.object({
        search: z.string().optional().describe("Optional search query to filter customers by name, phone, or company."),
      }),
      execute: async ({ search }: { search?: string }) => {
        try {
          let path = `/api/customers`;
          if (search) path += `?search=${encodeURIComponent(search)}`;
          
          const req = apiRequest(path);
          const res = await getCustomersApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    createCustomer: tool({
      description: "Create a new customer/party.",
      parameters: z.object({
        name: z.string().describe("The name of the customer"),
        phone: z.string().optional().describe("The phone number of the customer"),
        company_name: z.string().optional().describe("The company name of the customer"),
        opening_balance: z.number().optional().describe("The opening balance of the customer. Positive means they owe you, negative means you owe them."),
      }),
      execute: async (body) => {
        try {
          const req = apiRequest(`/api/customers`, {
            method: 'POST',
            body: JSON.stringify(body),
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
      description: "Update an existing customer/party.",
      parameters: z.object({
        customerId: z.string().describe("The ID of the customer to update"),
        name: z.string().optional().describe("The updated name"),
        phone: z.string().optional().describe("The updated phone number"),
        company_name: z.string().optional().describe("The updated company name"),
        balance: z.number().optional().describe("The updated balance"),
      }),
      execute: async ({ customerId, ...body }) => {
        try {
          const req = apiRequest(`/api/customers/${customerId}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          });
          const res = await updateCustomerApi(req, { params: { customerId } });
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
      description: "Get a list of all transactions (payments in/out). Can be filtered by transaction type and specific customer.",
      parameters: z.object({
        type: z.enum(['payment-in', 'payment-out']).optional().describe("Filter by transaction type"),
        customerName: z.string().optional().describe("Optional name of the customer to filter transactions for"),
        customerId: z.string().optional().describe("Optional ID of the customer to filter transactions for"),
      }),
      execute: async ({ type, customerName, customerId }) => {
        try {
          let path = `/api/customer-transactions?limit=100`;
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
        customerId: z.string().describe("The ID of the customer"),
        paymentAmount: z.number().describe("The amount of the payment"),
        paymentMethodId: z.string().describe("The ID of the payment method (or 'cash', 'cheque')"),
        type: z.enum(['payment-in', 'payment-out']).describe("Type of transaction"),
        date: z.string().optional().describe("Date in YYYY-MM-DD format"),
      }),
      execute: async (body) => {
        try {
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
      execute: async ({ id }) => {
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
      description: "Get a list of all products. Can be searched by name or SKU.",
      parameters: z.object({
        search: z.string().optional().describe("Search term for product name or SKU"),
        type: z.enum(['goods', 'services', 'all']).optional().describe("Filter by product type"),
      }),
      execute: async ({ search, type }) => {
        try {
          let path = `/api/products?limit=50`;
          if (search) path += `&search=${encodeURIComponent(search)}`;
          if (type && type !== 'all') path += `&type=${type}`;
          
          const req = apiRequest(path);
          const res = await getProductsApi(req);
          return await res.json();
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    createProduct: tool({
      description: "Create a new product or service.",
      parameters: z.object({
        name: z.string().describe("The name of the product"),
        type: z.enum(['goods', 'services']).describe("The type of product (goods or services)"),
        sell_price: z.number().describe("The selling price of the product"),
        cost_price: z.number().optional().describe("The cost price of the product"),
        sku: z.string().optional().describe("The SKU or barcode of the product"),
        quantity: z.number().optional().describe("Current stock quantity"),
        category: z.string().optional().describe("Product category"),
      }),
      execute: async (body) => {
        try {
          const req = apiRequest(`/api/products`, {
            method: 'POST',
            body: JSON.stringify(body),
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
        productId: z.string().describe("The ID of the product to update"),
        name: z.string().optional(),
        sell_price: z.number().optional(),
        cost_price: z.number().optional(),
        quantity: z.number().optional(),
        category: z.string().optional(),
      }),
      execute: async ({ productId, ...body }) => {
        try {
          const req = apiRequest(`/api/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          });
          const res = await updateProductApi(req, { params: { productId } });
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
});
