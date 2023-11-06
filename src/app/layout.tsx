import type { Metadata } from "next";
import { Inter, Quantico } from "next/font/google";
import "./globals.css";

const headerFont = Quantico({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-header" });
const mainFont = Inter({ subsets: ["latin"], variable: "--font-main" });
//const monoFont = Inter({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Vladimir Klimontovich",
  description:
    "Personal website of Vladimir Klimontovich. I'm a tech entrepreneur and product engineer. Currently working on Jitsu (YC 20).",
  openGraph: {
    images: ["/api/og"],
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${headerFont.variable} ${mainFont.variable}`}>{children}</body>
    </html>
  );
}
