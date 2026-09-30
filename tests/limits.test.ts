import assert from "node:assert/strict";
import test from "node:test";
import { clientIp } from "../web/src/lib/client-ip.js";
test("only Vercel's trusted IP header is used in production; local forwarded headers are ignored", () => {
  const previous = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    assert.equal(
      clientIp(
        new Request("http://localhost", {
          headers: { "x-forwarded-for": "spoofed" },
        }),
      ),
      "127.0.0.1",
    );
    process.env.VERCEL = "1";
    assert.equal(
      clientIp(
        new Request("https://example.com", {
          headers: { "x-forwarded-for": "203.0.113.9", "x-real-ip": "spoofed" },
        }),
      ),
      "203.0.113.9",
    );
    assert.equal(
      clientIp(
        new Request("https://example.com", {
          headers: { "x-forwarded-for": "2001:0db8:0:0:0:0:0:1" },
        }),
      ),
      "2001:db8::1",
    );
    assert.throws(() =>
      clientIp(
        new Request("https://example.com", {
          headers: { "x-forwarded-for": "203.0.113.9, 192.0.2.1" },
        }),
      ),
    );
    assert.throws(() => clientIp(new Request("https://example.com")));
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});
