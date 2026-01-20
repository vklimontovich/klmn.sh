import axios from "axios";

const INTERNAL_TOKEN = process.env.INTERNAL_CALLS_TOKEN;

export function getInternalApiUrl(origin: string, path: string, params?: Record<string, any>): string {
  const url = new URL(path, origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
    });
  }
  return url.toString();
}

export async function internalApiCall(
  origin: string,
  path: string,
  opts: {
    method?: "GET" | "POST" | "PATCH";
    params?: Record<string, any>;
    body?: Record<string, any>;
    headers?: Record<string, string>;
    eventId?: string;
  } = {}
): Promise<void> {
  const { method = "GET", params, body, headers = {}, eventId } = opts;

  const url = getInternalApiUrl(origin, path, method === "GET" ? params : undefined);

  const requestHeaders: Record<string, string> = { ...headers };
  if (INTERNAL_TOKEN) {
    requestHeaders["x-internal-token"] = INTERNAL_TOKEN;
  }
  if (eventId) {
    requestHeaders["x-event-id"] = eventId;
  }

  try {
    await axios({
      method,
      url,
      headers: requestHeaders,
      data: method !== "GET" ? body : undefined,
      timeout: 10000,
    });
  } catch (error) {
    console.error(`[internal-api-call] ${method} ${path} failed:`, error);
  }
}

export function createPageViewCall(origin: string, pathname: string, eventId: string): () => Promise<void> {
  return () =>
    internalApiCall(origin, "/api/event", {
      method: "GET",
      params: { type: "pageView", params: { pageUrl: pathname } },
      eventId,
    });
}
