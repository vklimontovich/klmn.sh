import { prisma } from "@/lib/server/prisma";

export  async function GET() {
  try {
    await prisma.log.count();
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: e.message || "unknown error",
      }),
      { status: 500 }
    );
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
