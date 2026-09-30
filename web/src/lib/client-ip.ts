import { isIP } from "node:net";
export function clientIp(request: Request): string {
  // Vercel overwrites X-Forwarded-For with the connection's public IP.
  // Outside Vercel, ignore caller-controlled forwarded headers entirely.
  if (!process.env.VERCEL) return "127.0.0.1";
  const value = request.headers.get("x-forwarded-for")?.trim();
  if (!value || !isIP(value)) throw new Error("Trusted client IP unavailable.");
  return isIP(value) === 6
    ? new URL(`http://[${value}]/`).hostname.slice(1, -1)
    : value;
}
