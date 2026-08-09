export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "1465101935058460";

type MetaPixelStandardEvent =
  | "PageView"
  | "Lead"
  | "CompleteRegistration"
  | "Login"
  | "Search"
  | "ViewContent"
  | "AddPaymentInfo"
  | "InitiateCheckout"
  | "Purchase";

type MetaPixelCustomEvent = string;

declare global {
  interface Window {
    fbq?: (
      command: "init" | "track" | "trackCustom",
      eventNameOrPixelId: string,
      parameters?: Record<string, unknown>,
    ) => void;
  }
}

const getFbq = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return typeof window.fbq === "function" ? window.fbq : null;
};

export const trackMetaStandardEvent = (
  eventName: MetaPixelStandardEvent,
  parameters?: Record<string, unknown>,
) => {
  const fbq = getFbq();
  if (!fbq) {
    return;
  }

  fbq("track", eventName, parameters);
};

export const trackMetaCustomEvent = (
  eventName: MetaPixelCustomEvent,
  parameters?: Record<string, unknown>,
) => {
  const fbq = getFbq();
  if (!fbq) {
    return;
  }

  fbq("trackCustom", eventName, parameters);
};
