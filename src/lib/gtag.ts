export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

export const pageview = (url: string) => {
  if (!GA_MEASUREMENT_ID) return;
  if (typeof window === "undefined") return;
  // GA4 page_view
  (window as any).gtag?.("event", "page_view", {
    page_path: url,
  });
};

export type GAEventParams = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  params?: Record<string, any>;
};

export const event = ({
  action,
  category,
  label,
  value,
  params,
}: GAEventParams) => {
  if (!GA_MEASUREMENT_ID) return;
  if (typeof window === "undefined") return;
  (window as any).gtag?.("event", action, {
    event_category: category,
    event_label: label,
    value,
    ...params,
  });
};
