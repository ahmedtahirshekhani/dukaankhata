/**
 * GTM Business Event Tracking Helpers
 *
 * High-level functions for tracking common business events in the POS system.
 * These are wrappers around the low-level GTM push functions in src/lib/analytics/gtm.ts
 * and Meta Pixel helpers in src/lib/analytics/meta-pixel.ts.
 */

import { pushBusinessEvent } from "@/lib/analytics/gtm";
import {
  trackMetaCustomEvent,
  trackMetaStandardEvent,
} from "@/lib/analytics/meta-pixel";

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

  trackMetaStandardEvent("Purchase", {
    value: invoice.total,
    currency: "PKR",
    content_type: "product",
    content_ids: invoice.items.map((item) => item.id),
    num_items: invoice.items.reduce((sum, item) => sum + item.quantity, 0),
  });
};

/**
 * Track user login event.
 */
export const trackLogin = () => {
  pushBusinessEvent({
    event: "login",
  });

  trackMetaStandardEvent("Login");
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

  trackMetaStandardEvent("Search", {
    search_string: query,
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

  trackMetaCustomEvent(`Customer${action.charAt(0).toUpperCase()}${action.slice(1)}`, {
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

  trackMetaStandardEvent("ViewContent", {
    content_ids: [productId],
    content_name: productName,
    content_type: "product",
    value: price,
    currency: "PKR",
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

  trackMetaStandardEvent("InitiateCheckout", {
    value: order.total,
    currency: "PKR",
    num_items: order.itemCount,
    order_id: order.id,
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

  trackMetaCustomEvent("CategoryEvent", {
    category,
    action,
    label,
    value,
  });
};

export const trackHomepageViewed = () => {
  trackMetaCustomEvent("HomepageViewed", {
    page_type: "landing",
  });
};

export const trackTrialSignupIntent = (source: string) => {
  trackMetaCustomEvent("TrialSignupIntent", {
    source,
  });
};

export const trackSubscriptionRenewalViewed = (status: string, plan?: string) => {
  trackMetaCustomEvent("SubscriptionRenewalViewed", {
    status,
    plan,
  });
};

export const trackSubscriptionRenewalContactClicked = (
  channel: "whatsapp" | "call" | "email",
  status: string,
  plan?: string,
) => {
  trackMetaCustomEvent("SubscriptionRenewalContactClicked", {
    channel,
    status,
    plan,
  });
};

export const trackPlanWhatsAppOpened = (
  plan: string,
  price: string,
) => {
  trackMetaCustomEvent("PlanWhatsAppOpened", {
    channel: "whatsapp",
    plan,
    price,
  });
};
