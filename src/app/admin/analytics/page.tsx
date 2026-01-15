import { prisma } from "@/lib/server/prisma";
import { AnalyticsTable } from "./AnalyticsTable";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ showBots?: string; showLocalhost?: string }>;
};

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams;
  const showBots = params.showBots === "true";
  const showLocalhost = params.showLocalhost === "true";

  const events = await prisma.analyticsEvents.findMany({
    orderBy: { timestamp: "desc" },
    take: 500,
  });

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Analytics Events</h1>
        <AnalyticsTable events={events} showBots={showBots} showLocalhost={showLocalhost} />
      </div>
    </main>
  );
}
