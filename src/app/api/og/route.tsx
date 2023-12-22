import { ImageResponse } from "@vercel/og";
import React from "react";

import { headshotPng } from "@/lib/headshot";

export const runtime = "edge";

export async function GET(request: Request) {
  return new ImageResponse(
    (
      <div tw="flex flex-col relative">
        <span tw="absolute" style={{ zIndex: 100, top: "150px", left: "100px", maxWidth: "600px", width: "600px" }}>
          <img
            width="256"
            height="256"
            src={headshotPng}
            style={{
              borderRadius: 128,
            }}
          />
        </span>

        <span
          tw="absolute flex flex-col"
          style={{ zIndex: 100, top: "130px", left: "400px", maxWidth: "600px", width: "600px" }}
        >
          <p tw="text-7xl font-bold" style={{ fontFamily: "inter-bold" }}>
            Vladimir Klimontovich
          </p>
          {
            <p tw="text-3xl text-zinc-600 font-bold" style={{ fontFamily: "inter-regular" }}>
              Tech entrepreneur and product engineer. Founder of Jitsu (YC S20).
            </p>
          }
        </span>
      </div>
    ),
    {
      width: 1200,
      height: 600,
    }
  );
}
