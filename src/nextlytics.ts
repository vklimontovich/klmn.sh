import { Nextlytics } from "@nextlytics/core/server";
import { googleAnalyticsBackend } from "@nextlytics/core/backends/ga";
import { neonBackend } from "@nextlytics/core/backends/neon";
import { segmentBackend } from "@nextlytics/core/backends/segment";
import type { BackendConfigEntry } from "@nextlytics/core";

const backends: BackendConfigEntry[] = [
  neonBackend({
    databaseUrl: process.env.DATABASE_URL!,
    tableName: "analytics",
  }),
];

if (process.env.JITSU_WRITE_KEY) {
  backends.push({
    backend: segmentBackend({
      writeKey: process.env.JITSU_WRITE_KEY!,
      host: "https://ingest.g.jitsu.com",
    }),
    ingestPolicy: "on-client-event",
  });
}
if (process.env.GA_MEASUREMENT_ID && process.env.GA_API_SECRET) {
  backends.push(
    googleAnalyticsBackend({
      measurementId: process.env.GA_MEASUREMENT_ID,
      apiSecret: process.env.GA_API_SECRET,
    })
  );
}

export const { middleware, handlers, analytics } = Nextlytics({ backends, callbacks: {} });
