export type ValuationMethod = "average" | "fifo" | "static";

export interface InventoryBatch {
  id?: string;
  _id?: any;
  user_id: string;               // Multi-tenant user ID
  product_id: string;            // Product Reference ID
  source_type: "opening_stock" | "purchase_bill" | "sale_return";
  source_id: string;             // purchase_bill ID, order ID, or "OPENING"
  batch_number: string;          // Human-readable reference e.g. "PB-001" or "OPENING"
  
  initial_quantity: number;      // Quantity received
  remaining_quantity: number;    // Quantity currently remaining in this lot
  cost_price: number;            // Purchase cost per unit in this lot
  
  status: "active" | "depleted"; // "active" if remaining_quantity > 0, else "depleted"
  batch_date: string | Date;     // Date for FIFO chronological ordering
  created_at: string | Date;
  updated_at: string | Date;
}

export interface BatchSplitItem {
  batch_id: string;
  batch_number?: string;
  quantity: number;
  cost_price: number;
  total_cost: number;
}

export interface BatchConsumptionResult {
  consumed_batches: BatchSplitItem[];
  total_cogs: number;
  remaining_unfulfilled_qty: number;
  effective_unit_cost: number;
}
