import { headers } from "next/headers";
import { PageViewAnalytics } from "./PageViewAnalytics";

export async function AnalyticsProvider() {
  const headersList = await headers();
  const eventId = headersList.get("x-analytics-event-id");
  return <PageViewAnalytics eventId={eventId} />;
}
