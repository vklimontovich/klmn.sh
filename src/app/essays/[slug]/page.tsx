import { Essay, essays, getEssay, MdxEssay, NotionEssay } from "@/content";
import assert from "assert";
import { NotionAPI } from "notion-client";
import { NotionView } from "@/components/notion-view";
import { MarkdownView } from "@/components/markdown-view";
import { mainFont } from "@/app/fonts";
import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotionLogo } from "@/components/icons";
import fs from "fs/promises";
import path from "path";

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


async function getEssayContent(essay: NotionEssay | MdxEssay) {
  if ("mdxFile" in essay && essay.mdxFile) {
    const filePath = path.join(process.cwd(), "src/content", essay.mdxFile);
    const content = await fs.readFile(filePath, "utf-8");
    return { type: "mdx" as const, content };
  } else {
    const notionEssay = essay as NotionEssay;
    const notion = new NotionAPI();
    const data = await notion.getPage(notionEssay.notionId);
    return { type: "notion" as const, data };
  }
}

export default async function EssayPage(props: any) {
  const essay = getEssay(props);
  const content = await getEssayContent(essay);

  return (
    <div>
      <h1 className={`text-3xl ${mainFont.className} font-bold`}>{essay.title}</h1>
      {content.type === "mdx" && (
        <div className="mt-4 mb-8 pb-6 border-b border-zinc-200">
          {essay.subtitle && <p className="text-xl text-zinc-600 font-light leading-relaxed">{essay.subtitle}</p>}
          <p className="text-sm text-zinc-400 mt-3">
            {essay.date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      )}
      {content.type === "notion" && <div className="mb-6" />}
      <div>
        {content.type === "notion" ? <NotionView data={content.data} /> : <MarkdownView content={content.content} />}
      </div>
      <hr />
      <div className="flex justify-between items-center">
        <Link href="/#essays" className="py-6 text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          <div>Home</div>
        </Link>
        {essay.notionId && (
          <div>
            <Link href={`https://notion.so/${essay.notionId}`} className="w-3 h-3 block">
              <NotionLogo />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
