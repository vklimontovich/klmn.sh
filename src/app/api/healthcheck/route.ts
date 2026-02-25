import { neon } from "@neondatabase/serverless";

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`SELECT 1`;
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "unknown error" }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
