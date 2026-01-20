"use client";

import { useEffect } from "react";
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

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function useAnalytics() {
  const pathname = usePathname();

  return {
    trackEvent: async (
      eventName: string,
      options: { params?: Record<string, any>; signal?: AbortSignal; preferBeacon?: boolean } = {}
    ) => {
      const { params = {}, signal, preferBeacon = false } = options;

      const eventParams = { pageUrl: pathname, ...params };
      const csc = encodeURIComponent(JSON.stringify(getClientSideContext()));
      const eventUrl = `/api/event?type=${encodeURIComponent(eventName)}&params=${encodeURIComponent(JSON.stringify(eventParams))}&csc=${csc}`;

      if (preferBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(eventUrl);
        return;
      }

      try {
        await fetch(eventUrl, { signal });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error(`Failed to track event ${eventName}:`, error);
      }
    },
  };
}

// PageView is registered by middleware, this component patches it with clientSideContext
export function PageViewAnalytics() {
  const analytics = useAnalytics();
  const pathname = usePathname();

  // Patch pageView event with clientSideContext
  useEffect(() => {
    const eventId = getCookie("x-analytics-event-id");
    if (!eventId) return;

    deleteCookie("x-analytics-event-id");

    fetch("/api/event", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: eventId, clientSideContext: getClientSideContext() }),
    }).catch((error) => {
      console.error("Failed to patch pageView with clientSideContext:", error);
    });
  }, [pathname]);

  // Track link clicks
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a");

      if (link && link.href) {
        analytics.trackEvent("linkClick", {
          preferBeacon: true,
          params: {
            url: link.href,
            isExternal: link.hostname !== window.location.hostname,
            isDownload: link.hasAttribute("download"),
            text: link.textContent?.trim() || "",
          },
        });
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname, analytics]);

  return null;
}
