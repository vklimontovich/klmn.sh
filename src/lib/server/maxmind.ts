import { prisma } from "@/lib/server/prisma";
import { MaxMindResponse, MaxMindResponseSchema } from "@/lib/analytics-types";

const CACHE_DURATION_DAYS = 10;

// Bot user types from MaxMind
const BOT_USER_TYPES = ["search_engine_spider", "crawler", "content_server"];

function isPrivateIp(ip: string): boolean {
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

function detectBot(data: MaxMindResponse): boolean {
  const traits = data.traits;
  if (!traits) return false;

  // Check user type (MaxMind's classification)
  if (traits.user_type && BOT_USER_TYPES.includes(traits.user_type)) return true;

  // Check hosting/proxy indicators from MaxMind
  if (traits.is_hosting_provider) return true;
  if (traits.is_anonymous_proxy) return true;
  if (traits.is_public_proxy) return true;
  if (traits.is_tor_exit_node) return true;

  return false;
}

// Strip non-English names from the response
function stripToEnglish(data: MaxMindResponse): MaxMindResponse {
  const stripNames = (names?: { en?: string }): { en?: string } | undefined => {
    if (!names?.en) return undefined;
    return { en: names.en };
  };

  return {
    ...data,
    city: data.city ? { ...data.city, names: stripNames(data.city.names) } : undefined,
    continent: data.continent ? { ...data.continent, names: stripNames(data.continent.names) } : undefined,
    country: data.country ? { ...data.country, names: stripNames(data.country.names) } : undefined,
    registered_country: data.registered_country
      ? { ...data.registered_country, names: stripNames(data.registered_country.names) }
      : undefined,
    represented_country: data.represented_country
      ? { ...data.represented_country, names: stripNames(data.represented_country.names) }
      : undefined,
    subdivisions: data.subdivisions?.map(s => ({ ...s, names: stripNames(s.names) })),
    // Remove maxmind metadata (queries_remaining etc)
    maxmind: undefined,
  };
}

async function fetchFromMaxMind(ip: string): Promise<MaxMindResponse | null> {
  const accountId = process.env.MAXMIND_ACCOUNT_ID;
  const licenseKey = process.env.MAXMIND_LICENSE_KEY;

  if (!accountId || !licenseKey) {
    throw new Error("MaxMind credentials not configured");
  }

  const auth = Buffer.from(`${accountId}:${licenseKey}`).toString("base64");

  try {
    const response = await fetch(`https://geoip.maxmind.com/geoip/v2.1/insights/${ip}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      console.error(`MaxMind API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return MaxMindResponseSchema.parse(data);
  } catch (error) {
    console.error("Failed to fetch from MaxMind:", error);
    return null;
  }
}

export async function getLocationForIp(ip: string): Promise<MaxMindResponse | null> {
  if (!ip || isPrivateIp(ip)) return null;

  // Check cache first (already processed/stripped)
  const cached = await prisma.maxMindCache.findUnique({ where: { ip } });

  if (cached && cached.expiresAt > new Date()) {
    const location = cached.location as MaxMindResponse;
    location.isBot = detectBot(location);
    return location;
  }

  // Fetch from MaxMind
  const rawData = await fetchFromMaxMind(ip);
  if (!rawData) return null;

  // Process: strip non-English, detect bot
  const location = stripToEnglish(rawData);
  location.isBot = detectBot(rawData);

  // Cache
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_DURATION_DAYS);

  await prisma.maxMindCache.upsert({
    where: { ip },
    create: { ip, location: location as any, expiresAt },
    update: { location: location as any, expiresAt },
  });

  return location;
}

// Helper to get display-friendly organization name
export function getDisplayOrg(location: MaxMindResponse | null): string {
  if (!location?.traits) return "Unknown";

  const { user_type, organization, isp } = location.traits;

  // For residential users, show "Residential" or ISP name
  if (user_type === "residential") {
    return isp || "Residential";
  }

  // For business, show organization if it looks like a real company (not ISP)
  if (user_type === "business" && organization && organization !== isp) {
    return organization;
  }

  // Default to ISP or organization
  return isp || organization || "Unknown";
}
