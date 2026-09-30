import { timingSafeEqual } from "node:crypto";
import { runEnrichment } from "@/lib/agent";
export const runtime = "nodejs";
export const maxDuration = 180;
const recent = new Map<string, number>();
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Request origin not allowed." },
      { status: 403 },
    );
  const secret = process.env.DEMO_ACCESS_TOKEN;
  if (secret) {
    const supplied =
      request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    const expected = Buffer.from(secret),
      actual = Buffer.from(supplied);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return Response.json(
        { error: "Enter the live demo access code to run this agent." },
        { status: 401 },
      );
  } else if (process.env.VERCEL)
    return Response.json(
      {
        error:
          "Live lookups are disabled on this deployment. Deploy the template to run your own agent.",
      },
      { status: 503 },
    );
  let email: string;
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error();
  } catch {
    return Response.json(
      { error: "Enter one valid email address." },
      { status: 400 },
    );
  }
  // A small per-instance throttle complements the access code; it is not a global quota.
  const now = Date.now();
  for (const [key, time] of recent) if (now - time > 60000) recent.delete(key);
  if (recent.size >= 5 || recent.has(email))
    return Response.json(
      { error: "Please wait a minute before starting another lookup." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  recent.set(email, now);
  try {
    return Response.json(await runEnrichment(email), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "The enrichment failed.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
