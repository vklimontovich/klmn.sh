import { prisma } from "@/lib/server/prisma";
import { AnalyticsTable } from "./AnalyticsTable";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ showBots?: string; showLocalhost?: string }>;
};

export default async function AnalyticsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/admin/login?callbackUrl=/admin/analytics");
  }

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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Analytics Events</h1>
          <span className="text-sm text-gray-500">{session.user?.email}</span>
        </div>
        <AnalyticsTable events={events} showBots={showBots} showLocalhost={showLocalhost} />
      </div>
    </main>
  );
}
