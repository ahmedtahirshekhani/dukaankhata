import { z } from "zod";
import { getCollection, COLLECTIONS, toObjectId, setLastUpdated } from "@/lib/db/mongodb";
import { seedCustomerOpeningBalance } from "@/lib/ledger/customer-ledger";
import { tool } from "ai";

export const customerTools = (userId: string) => {
  return {
    getCustomers: tool({
      description: "Get a list of all customers/parties for the user.",
      parameters: z.object({
        search: z.string().optional().describe("Optional search query to filter customers by name, phone, or company."),
      }),
      execute: async ({ search }: { search?: string }) => {
        try {
          const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
          const query: any = { user_id: toObjectId(userId), is_delete: { $ne: 1 } };
          
          if (search) {
            query.$or = [
              { name: { $regex: search, $options: "i" } },
              { phone: { $regex: search, $options: "i" } },
              { company_name: { $regex: search, $options: "i" } },
            ];
          }

          const data = await customersCollection
            .find(query, {
              projection: { _id: 1, name: 1, phone: 1, company_name: 1, balance: 1, opening_balance: 1 }
            })
            .sort({ created_at: -1 })
            .limit(20)
            .toArray();

          return {
            customers: data.map((c) => ({
              id: c._id.toString(),
              name: c.name,
              phone: c.phone,
              company: c.company_name,
              balance: c.balance !== undefined ? c.balance : c.opening_balance
            }))
          };
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
      execute: async ({ name, phone, company_name, opening_balance }: { name: string; phone?: string; company_name?: string; opening_balance?: number }) => {
        try {
          const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
          const existing = await customersCollection.findOne({
            user_id: toObjectId(userId),
            name: name,
            is_delete: { $ne: 1 },
          });

          if (existing) {
            return { error: "A customer with this name already exists." };
          }

          const now = new Date();
          const newCustomer = {
            name,
            phone: phone || "",
            company_name: company_name || "",
            opening_balance: opening_balance || 0,
            balance: opening_balance || 0,
            user_id: toObjectId(userId),
            status: "active",
            is_delete: 0,
            created_at: now,
            updated_at: now,
          };

          const result = await customersCollection.insertOne(newCustomer);
          
          if (result.insertedId) {
            await seedCustomerOpeningBalance(
              userId,
              result.insertedId.toString(),
              newCustomer.opening_balance,
              now
            );
            return { success: true, message: `Customer ${name} created successfully.`, customerId: result.insertedId.toString() };
          }
          return { error: "Failed to create customer" };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    deleteCustomer: tool({
      description: "Delete a customer/party by their ID or Name.",
      parameters: z.object({
        name: z.string().describe("The exact name of the customer to delete"),
      }),
      execute: async ({ name }: { name: string }) => {
        try {
          const customersCollection = await getCollection(COLLECTIONS.CUSTOMERS);
          const customer = await customersCollection.findOne({ user_id: toObjectId(userId), name, is_delete: { $ne: 1 } });
          
          if (!customer) {
            return { error: `Customer with name ${name} not found.` };
          }

          await setLastUpdated(customersCollection, { _id: customer._id }, { is_delete: 1, deleted_at: new Date() });
          return { success: true, message: `Customer ${name} deleted successfully.` };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),
  };
};
