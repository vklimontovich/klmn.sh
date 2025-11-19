import { CVPage } from "@/components/CVPage";
import { Metadata } from "next";
import { cvCopy } from "@/content/cv";

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
