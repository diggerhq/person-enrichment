import { normalizeIcp } from "@/lib/qualification";
import { runEnrichment } from "@/lib/agent";
import { reserveEnrichment } from "@/lib/limits";
import { clientIp } from "@/lib/client-ip";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Request origin not allowed." },
      { status: 403 },
    );
  let email: string;
  let icp: string;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Enter one valid email address.");
    icp = normalizeIcp(body.icp);
    email = typeof body.email === "string" ? body.email.trim() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Enter one valid email address.");
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "Enter one valid email address.",
      },
      { status: 400 },
    );
  }
  let permit;
  try {
    permit = await reserveEnrichment(clientIp(request));
  } catch {
    return Response.json(
      {
        error: "Enrichment is temporarily unavailable. Please try again later.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!permit.allowed)
    return Response.json(
      { error: permit.error },
      {
        status: 429,
        headers: {
          "Retry-After": String(permit.retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  try {
    return Response.json(await runEnrichment(email, icp), {
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
  } finally {
    await permit
      .release()
      .catch(() =>
        console.warn(
          "Enrichment lease release failed; it will expire automatically.",
        ),
      );
  }
}
