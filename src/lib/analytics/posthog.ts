import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

export const isPosthogEnabled = Boolean(POSTHOG_KEY);

export function getPosthogClient() {
  if (!isPosthogEnabled || typeof window === "undefined") {
    return null;
  }

  if (!initialized) {
    posthog.init(POSTHOG_KEY as string, {
      api_host: POSTHOG_HOST,
      autocapture: true,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
      session_recording: {
        maskAllInputs: true,
      },
    });
    initialized = true;
  }

  return posthog;
}

export function captureEvent(
  eventName: string,
  properties?: Record<string, any>,
) {
  const client = getPosthogClient();
  client?.capture(eventName, properties);
}

export function identifyUser(
  distinctId: string,
  properties?: Record<string, any>,
) {
  const client = getPosthogClient();
  if (!client) {
    return;
  }

  client.identify(distinctId, properties);
}

export function resetPosthog() {
  if (!initialized) {
    return;
  }

  posthog.reset();
}
