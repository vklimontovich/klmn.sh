import type { Metadata } from "next";
import "./globals.css";
import { NextCollectProvider } from "next-collect/client";
import { headerFont, mainFont } from "@/app/fonts";


export const metadata: Metadata = {
  title: "Vladimir Klimontovich",
  description:
    "Personal website of Vladimir Klimontovich. I'm a tech entrepreneur and product engineer. Currently working on Jitsu (YC 20).",
  openGraph: {
    images: ["/api/og"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${headerFont.variable} ${mainFont.variable}`}>
        <NextCollectProvider
          tags={[
            process.env.NEXT_PUBLIC_GA4 && {
              type: "ga4",
              opts: { debug: true, containerId: process.env.NEXT_PUBLIC_GA4 },
            },
          ]}
        >
          {children}
        </NextCollectProvider>
      </body>
    </html>
  );
}
