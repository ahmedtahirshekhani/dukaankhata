export interface Product {
  id: string | number;
  _id?: string | number;
  type?: string;
  name: string;
  description?: string;
  price?: number;
  sell_price?: number;
  cost_price?: number;
  in_stock?: number;
  quantity?: number;
  damaged_quantity?: number;
  category?: string;
  unit_of_measurement?: string;
  branch?: string;
}
