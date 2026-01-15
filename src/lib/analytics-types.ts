import { z } from "zod/v4";

export const ClientSideContextSchema = z.object({
  referrer: z.string().optional(),
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
  devicePixelRatio: z.number().optional(),
  language: z.string().optional(),
  languages: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  timezoneOffset: z.number().optional(),
  colorScheme: z.enum(["light", "dark"]).optional(),
  reducedMotion: z.boolean().optional(),
  cookieEnabled: z.boolean().optional(),
  doNotTrack: z.boolean().optional(),
  touchSupport: z.boolean().optional(),
  connectionType: z.string().optional(),
  connectionDownlink: z.number().optional(),
});

export type ClientSideContext = z.infer<typeof ClientSideContextSchema>;

// MaxMind GeoIP2 Insights API response schemas (snake_case as returned by API)
const MaxMindNamesSchema = z.object({
  en: z.string().optional(),
}).passthrough();

const MaxMindCitySchema = z.object({
  geoname_id: z.number().optional(),
  names: MaxMindNamesSchema.optional(),
  confidence: z.number().optional(),
}).passthrough();

const MaxMindContinentSchema = z.object({
  code: z.string().optional(),
  geoname_id: z.number().optional(),
  names: MaxMindNamesSchema.optional(),
}).passthrough();

const MaxMindCountrySchema = z.object({
  geoname_id: z.number().optional(),
  iso_code: z.string().optional(),
  names: MaxMindNamesSchema.optional(),
  confidence: z.number().optional(),
  is_in_european_union: z.boolean().optional(),
}).passthrough();

const MaxMindLocationSchema = z.object({
  accuracy_radius: z.number().optional(),
  average_income: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  metro_code: z.number().optional(),
  population_density: z.number().optional(),
  time_zone: z.string().optional(),
}).passthrough();

const MaxMindPostalSchema = z.object({
  code: z.string().optional(),
  confidence: z.number().optional(),
}).passthrough();

const MaxMindSubdivisionSchema = z.object({
  geoname_id: z.number().optional(),
  iso_code: z.string().optional(),
  names: MaxMindNamesSchema.optional(),
  confidence: z.number().optional(),
}).passthrough();

const MaxMindTraitsSchema = z.object({
  autonomous_system_number: z.number().optional(),
  autonomous_system_organization: z.string().optional(),
  connection_type: z.string().optional(),
  domain: z.string().optional(),
  ip_address: z.string().optional(),
  is_anonymous: z.boolean().optional(),
  is_anonymous_proxy: z.boolean().optional(),
  is_anonymous_vpn: z.boolean().optional(),
  is_anycast: z.boolean().optional(),
  is_hosting_provider: z.boolean().optional(),
  is_legitimate_proxy: z.boolean().optional(),
  is_public_proxy: z.boolean().optional(),
  is_residential_proxy: z.boolean().optional(),
  is_satellite_provider: z.boolean().optional(),
  is_tor_exit_node: z.boolean().optional(),
  isp: z.string().optional(),
  mobile_country_code: z.string().optional(),
  mobile_network_code: z.string().optional(),
  network: z.string().optional(),
  organization: z.string().optional(),
  static_ip_score: z.number().optional(),
  user_count: z.number().optional(),
  user_type: z.string().optional(),
}).passthrough();

const MaxMindMaxMindSchema = z.object({
  queries_remaining: z.number().optional(),
}).passthrough();

export const MaxMindResponseSchema = z.object({
  city: MaxMindCitySchema.optional(),
  continent: MaxMindContinentSchema.optional(),
  country: MaxMindCountrySchema.optional(),
  location: MaxMindLocationSchema.optional(),
  postal: MaxMindPostalSchema.optional(),
  registered_country: MaxMindCountrySchema.optional(),
  represented_country: MaxMindCountrySchema.optional(),
  subdivisions: z.array(MaxMindSubdivisionSchema).optional(),
  traits: MaxMindTraitsSchema.optional(),
  maxmind: MaxMindMaxMindSchema.optional(),
  // Added by us after processing
  isBot: z.boolean().optional(),
}).passthrough();

export type MaxMindResponse = z.infer<typeof MaxMindResponseSchema>;
