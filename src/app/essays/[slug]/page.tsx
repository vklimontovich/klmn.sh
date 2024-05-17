import { Essay, essays, getEssay } from "@/content";
import assert from "assert";
import { NotionAPI } from "notion-client";
import { NotionView } from "@/components/notion-view";
import { mainFont } from "@/app/fonts";
import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotionLogo } from "@/components/icons";

// or Dynamic metadata
export async function generateMetadata(props: any) {
  const essay = getEssay(props);
  return {
    title: `${essay.title} - by Vladimir Klimontovich`,
    openGraph: {
      title: `${essay.title} - by Vladimir Klimontovich`,
      description: essay.subtitle,
      images: {
        url: `/essays/${essay.slug}/og`,
        alt: essay.title,
      },
    }
  };
}


export default async function EssayPage(props: any) {
  const essay = getEssay(props);
  const notion = new NotionAPI();

  const data = await notion.getPage(essay.notionId);
  return (
    <div>
      <h1 className={`text-3xl ${mainFont.className} font-bold`}>{essay.title}</h1>
      <div>
        <NotionView data={data} />
      </div>
      <hr />
      <div className="flex justify-between items-center">
        <Link href="/#essays" className="py-6 text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          <div>Home</div>
        </Link>
        <div>
          <Link href={`https://notion.so/${essay.notionId}`} className="w-3 h-3 block">
            <NotionLogo />
          </Link>
        </div>
      </div>
    </div>
  );
}
