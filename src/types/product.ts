export interface Product {
  id: string;
  _id?: string | number;
  type?: string;
  name: string;
  description?: string;
  price?: number;
  sell_price?: number;
  cost_price?: number;
  in_stock?: number;
  quantity?: number;
  quantity_str?: string;
  damaged_quantity?: number;
  damaged_quantity_str?: string;
  sell_price_str?: string;
  cost_price_str?: string;
  category?: string;
  unit_of_measurement?: string;
  branch?: string;
}
