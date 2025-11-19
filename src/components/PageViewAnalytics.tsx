"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

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

      const eventUrl = `/api/event?type=${encodeURIComponent(eventName)}&params=${encodeURIComponent(JSON.stringify(eventParams))}`;

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
