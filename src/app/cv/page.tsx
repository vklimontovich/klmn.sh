import { CVPage } from "@/components/CVPage";
import { cvCopy } from "@/content/cv";
import { Metadata } from "next";

const copy = cvCopy.default;

export const metadata: Metadata = {
  title: `${copy.name} - CV`,
  description: copy.shortDescription,
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: `${copy.name} - CV`,
    description: copy.shortDescription,
    type: "profile",
    images: ["/api/og/cv"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${copy.name} - CV`,
    description: copy.shortDescription,
  },
};

export default function Page() {
  return (
    <main className="w-full flex justify-center mx-auto">
      <CVPage />
    </main>
  );
}
