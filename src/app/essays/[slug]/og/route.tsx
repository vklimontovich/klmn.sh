import { ImageResponse } from "@vercel/og";
import React from "react";
import { NextRequest } from "next/server";
import { getEssay } from "@/content";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  console.log("Request PARAMS", request.nextUrl.searchParams.toString());
  console.log("Slug", slug);

  const essay = getEssay({ params: { slug: slug } });
  return new ImageResponse(
    (
      <div tw="flex flex-col relative">
        <span
          tw="absolute flex flex-col"
          style={{ zIndex: 100, top: "130px", left: "100px", maxWidth: "900px", width: "900px" }}
        >
          <p tw="text-7xl font-bold" style={{ fontFamily: "inter-bold" }}>
            {essay.title}
          </p>
          <p tw="text-3xl text-zinc-600 font-bold" style={{ fontFamily: "inter-regular" }}>
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
