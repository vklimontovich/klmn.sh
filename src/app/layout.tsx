import type { Metadata } from "next";
import "./globals.css";
import { headerFont, mainFont } from "@/app/fonts";
import { PageViewAnalytics } from "@/components/PageViewAnalytics";


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
        <PageViewAnalytics />
        {children}
      </body>
    </html>
  );
}
