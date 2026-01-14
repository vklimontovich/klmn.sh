import { prisma } from "@/lib/server/prisma";

// MaxMind Insights API response type (no zod - just type assertion)
export type MaxMindLocation = {
  city?: { geonameId?: number; names?: Record<string, string>; name?: string };
  continent?: { code?: string; geonameId?: number; names?: Record<string, string>; name?: string };
  country?: { geonameId?: number; isoCode?: string; names?: Record<string, string>; name?: string; isInEuropeanUnion?: boolean };
  location?: { accuracyRadius?: number; averageIncome?: number; latitude?: number; longitude?: number; metroCode?: number; populationDensity?: number; timeZone?: string };
  postal?: { code?: string; confidence?: number };
  registeredCountry?: { geonameId?: number; isoCode?: string; names?: Record<string, string>; name?: string; isInEuropeanUnion?: boolean };
  representedCountry?: { geonameId?: number; isoCode?: string; names?: Record<string, string>; name?: string; type?: string; isInEuropeanUnion?: boolean };
  subdivisions?: Array<{ geonameId?: number; isoCode?: string; names?: Record<string, string>; name?: string; confidence?: number }>;
  traits?: {
    autonomousSystemNumber?: number; autonomousSystemOrganization?: string; connectionType?: string;
    domain?: string; ipAddress?: string; isAnonymous?: boolean; isAnonymousProxy?: boolean;
    isAnonymousVpn?: boolean; isAnycast?: boolean; isHostingProvider?: boolean; isLegitimateProxy?: boolean;
    isPublicProxy?: boolean; isResidentialProxy?: boolean; isSatelliteProvider?: boolean;
    isTorExitNode?: boolean; isp?: string; mobileCountryCode?: string; mobileNetworkCode?: string;
    network?: string; organization?: string; staticIpScore?: number; userCount?: number; userType?: string;
  };
  isBot?: boolean;
};

const CACHE_DURATION_DAYS = 10;

function isPrivateIp(ip: string): boolean {
  // Check for private IP ranges and localhost
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^localhost$/i,
    /^fc00:/,
    /^fe80:/,
  ];
  return privateRanges.some(range => range.test(ip));
}

async function fetchFromMaxMind(ip: string): Promise<MaxMindLocation | null> {
  const accountId = process.env.MAXMIND_ACCOUNT_ID;
  const licenseKey = process.env.MAXMIND_LICENSE_KEY;

  if (!accountId || !licenseKey) {
    throw new Error("MaxMind credentials not configured: MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY required");
  }

  const auth = Buffer.from(`${accountId}:${licenseKey}`).toString("base64");

  try {
    const response = await fetch(
      `https://geoip.maxmind.com/geoip/v2.1/insights/${ip}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // IP not found in database
        return null;
      }
      console.error(`MaxMind API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data as MaxMindLocation;
  } catch (error) {
    console.error("Failed to fetch from MaxMind:", error);
    return null;
  }
}

export async function getLocationForIp(ip: string): Promise<MaxMindLocation | null> {
  if (!ip || isPrivateIp(ip)) {
    return null;
  }

  // Check cache first
  const cached = await prisma.maxMindCache.findUnique({
    where: { ip },
  });

  if (cached && cached.expiresAt > new Date()) {
    return cached.location as MaxMindLocation;
  }

  // Fetch from MaxMind
  const location = await fetchFromMaxMind(ip);

  if (location) {
    // Add isBot flag
    location.isBot = detectBot(location);

    // Update or create cache entry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_DURATION_DAYS);

    await prisma.maxMindCache.upsert({
      where: { ip },
      create: {
        ip,
        location: location as any,
        expiresAt,
      },
      update: {
        location: location as any,
        expiresAt,
      },
    });
  }

  return location;
}

function detectBot(location: MaxMindLocation): boolean {
  if (!location.traits) return false;

  const botUserTypes = ["search_engine_spider", "crawler"];
  if (location.traits.userType && botUserTypes.includes(location.traits.userType)) {
    return true;
  }

  return false;
}
