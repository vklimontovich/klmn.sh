import { ImageResponse } from "@vercel/og";
import React from "react";
import { NextRequest } from "next/server";
import { getEssay } from "@/content";
import { headshotPng } from "@/lib/headshot";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const essay = getEssay({ params: { slug: slug } });

  return new ImageResponse(
    (
      <div tw="flex flex-col relative">
        <span tw="absolute" style={{ zIndex: 100, top: "80px", left: "80px" }}>
          <img
            width="180"
            height="180"
            src={headshotPng}
            style={{ borderRadius: 90 }}
          />
        </span>
        <span
          tw="absolute flex flex-col"
          style={{ zIndex: 100, top: "80px", left: "300px", maxWidth: "820px", width: "820px" }}
        >
          <p tw="text-5xl font-bold m-0" style={{ fontFamily: "inter-bold", lineHeight: 1.1 }}>
            {essay.title}
          </p>
          <p tw="text-2xl text-zinc-500 mt-4" style={{ fontFamily: "inter-regular", lineHeight: 1.3 }}>
            {essay.subtitle}
          </p>
          <p tw="text-xl text-zinc-400 mt-6" style={{ fontFamily: "inter-regular" }}>
            by Vladimir Klimontovich
          </p>
        </span>
      </div>
    ),
    {
      width: 1200,
      height: 600,
    }
  );
}
