"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ClientSideContext } from "@/lib/analytics-types";

function getClientSideContext(): ClientSideContext {
  const context: ClientSideContext = {};

  // Document info
  if (typeof document !== "undefined") {
    context.referrer = document.referrer || undefined;
  }

  // Screen info
  if (typeof screen !== "undefined") {
    context.screenWidth = screen.width;
    context.screenHeight = screen.height;
  }

  // Viewport info
  if (typeof window !== "undefined") {
    context.viewportWidth = window.innerWidth;
    context.viewportHeight = window.innerHeight;
    context.devicePixelRatio = window.devicePixelRatio;
  }

  // Navigator info
  if (typeof navigator !== "undefined") {
    context.language = navigator.language;
    context.languages = Array.from(navigator.languages || []);
    context.cookieEnabled = navigator.cookieEnabled;
    context.doNotTrack = navigator.doNotTrack === "1";
    context.touchSupport = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // Connection info
    const connection = (navigator as any).connection;
    if (connection) {
      context.connectionType = connection.effectiveType;
      context.connectionDownlink = connection.downlink;
    }
  }

  // Timezone
  try {
    context.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    context.timezoneOffset = new Date().getTimezoneOffset();
  } catch {}

  // Media queries
  if (typeof window !== "undefined" && window.matchMedia) {
    context.colorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    context.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  return context;
}

export function useAnalytics() {
  const pathname = usePathname();

  return {
    trackEvent: async (
      eventName: string,
      options: { params?: Record<string, any>; signal?: AbortSignal; preferBeacon?: boolean } = {}
    ) => {
      const { params = {}, signal, preferBeacon = false } = options;

      // Always add pageUrl if not specified
      const eventParams = {
        pageUrl: pathname,
        ...params,
      };

      const csc = encodeURIComponent(JSON.stringify(getClientSideContext()));
      const eventUrl = `/api/event?type=${encodeURIComponent(eventName)}&params=${encodeURIComponent(JSON.stringify(eventParams))}&csc=${csc}`;

      // Use sendBeacon for better reliability on page unload
      if (preferBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(eventUrl);
        return;
      }

      try {
        await fetch(eventUrl, { signal });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was cancelled, ignore
          return;
        }
        console.error(`Failed to track event ${eventName}:`, error);
      }
    },
  };
}

export function PageViewAnalytics() {
  const analytics = useAnalytics();
  const abortControllerRef = useRef<AbortController | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const trackPageView = async () => {
      // Cancel previous page view request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      await analytics.trackEvent("pageView", {
        signal: abortController.signal,
      });
    };

    trackPageView();
  }, [pathname, analytics]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a");

      if (link && link.href) {
        const url = link.href;
        const isExternal = link.hostname !== window.location.hostname;
        const isDownload = link.hasAttribute("download");

        analytics.trackEvent("linkClick", {
          preferBeacon: true,
          params: {
            url,
            isExternal,
            isDownload,
            text: link.textContent?.trim() || "",
          },
        });
      }
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [pathname, analytics]);

  return null;
}
