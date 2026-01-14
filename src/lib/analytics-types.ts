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
