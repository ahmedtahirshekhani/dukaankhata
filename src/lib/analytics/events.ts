/**
 * GTM Business Event Tracking Helpers
 *
 * High-level functions for tracking common business events in the POS system.
 * These are wrappers around the low-level GTM push functions in src/lib/analytics/gtm.ts
 */

import { pushBusinessEvent } from "@/lib/analytics/gtm";

/**
 * Track when an invoice is created/completed.
 * Useful for conversion tracking in a POS system.
 */
export const trackInvoiceCreated = (invoice: {
  id: string;
  total: number;
  tax?: number;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
}) => {
  pushBusinessEvent({
    event: "purchase",
    transactionId: invoice.id,
    transactionValue: invoice.total,
    transactionTax: invoice.tax,
    transactionProducts: invoice.items.map((item) => ({
      id: item.id,
      name: item.name,
      category: "product",
      price: item.price,
      quantity: item.quantity,
    })),
  });
};

/**
 * Track user login event.
 */
export const trackLogin = () => {
  pushBusinessEvent({
    event: "login",
  });
};

/**
 * Track product search or filter event.
 */
export const trackProductSearch = (query: string, resultCount: number) => {
  pushBusinessEvent({
    event: "search",
    search_term: query,
    result_count: resultCount,
  });
};

/**
 * Track when a customer is added, viewed, or updated.
 */
export const trackCustomerAction = (
  action: "view" | "add" | "update",
  customerId: string,
) => {
  pushBusinessEvent({
    event: `customer_${action}`,
    customer_id: customerId,
  });
};

/**
 * Track when a product is viewed.
 */
export const trackProductView = (
  productId: string,
  productName: string,
  price: number,
) => {
  pushBusinessEvent({
    event: "view_item",
    item_id: productId,
    item_name: productName,
    price,
  });
};

/**
 * Track when an order is created.
 */
export const trackOrderCreated = (order: {
  id: string;
  total: number;
  itemCount: number;
}) => {
  pushBusinessEvent({
    event: "order_created",
    order_id: order.id,
    order_value: order.total,
    item_count: order.itemCount,
  });
};

/**
 * Track custom category event.
 */
export const trackCategoryEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
) => {
  pushBusinessEvent({
    event: "custom_category_event",
    event_category: category,
    event_action: action,
    event_label: label,
    event_value: value,
  });
};
