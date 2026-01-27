/**
 * GTM (Google Tag Manager) utilities for sending events and data to the dataLayer.
 * Works in tandem with GA4 and other tags managed by GTM.
 * Integrates with the dataLayer that is initialized in the root layout.
 */

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "";

/**
 * Push an event to the GTM dataLayer.
 * This is the primary method for tracking custom events with GTM.
 * GTM rules and tags will listen to these events and forward them as needed.
 */
export type GTMEventParams = {
  event: string;
  [key: string]: any;
};

export const pushEvent = (params: GTMEventParams) => {
  if (!GTM_ID) return;
  if (typeof window === "undefined") return;
  // GTM dataLayer should already be initialized in layout.tsx
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push(params);
};

/**
 * Send a page view event to GTM.
 * Used by the GTM tracker component on route changes.
 */
export const pushPageView = (pageTitle: string, pageLocation: string) => {
  pushEvent({
    event: "page_view",
    page_title: pageTitle,
    page_location: pageLocation,
  });
};

/**
 * Set user-level custom variables (dimensions) in the dataLayer.
 * Useful for tracking user properties, authenticated state, user ID, etc.
 */
export const setUserData = (data: Record<string, any>) => {
  if (!GTM_ID) return;
  if (typeof window === "undefined") return;
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push({
    event: "gtm.custom",
    ...data,
  });
};

/**
 * Helper to push ecommerce-style or business events (invoice, order, etc).
 * This is useful for POS/inventory systems to track transactions.
 */
export type GTMBusinessEventParams = {
  event: string;
  transactionId?: string;
  transactionValue?: number;
  transactionTax?: number;
  transactionShipping?: number;
  transactionProducts?: Array<{
    id: string;
    name: string;
    category?: string;
    price: number;
    quantity: number;
  }>;
  [key: string]: any;
};

export const pushBusinessEvent = (params: GTMBusinessEventParams) => {
  pushEvent(params);
};
