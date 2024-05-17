import { Inter, Quantico, Inconsolata } from "next/font/google";

export const headerFont = Quantico({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-header" });
export const mainFont = Inter({ subsets: ["latin"], variable: "--font-main" });
export const monoFont = Inconsolata({ subsets: ["latin"], variable: "--font-mono" });
