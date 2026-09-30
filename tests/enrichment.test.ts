import assert from "node:assert/strict";
import test from "node:test";
import { enrich } from "../opencomputer/agents/enricher/tools/enrichment.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Treg-Call-Id": "call-test",
      "X-Treg-Cost-Micro": "26000",
    },
  });
test("rejects invalid emails without calling the provider", async () => {
  for (const email of [
    "",
    "two@example.com other@example.com",
    "bad",
    "x".repeat(255) + "@example.com",
  ]) {
    const result = await enrich(email, async () => {
      throw new Error("must not call");
    });
    assert.equal((result as any).error.code, "invalid_email");
  }
});
test("uses Apollo query parameters, spending cap and idempotency; normalizes only returned fields", async () => {
  const result = (await enrich(" Jane@Example.com ", async (path, init) => {
    const url = new URL(path, "https://treg.to");
    assert.equal(url.pathname, "/call/apollo.people.enrich");
    assert.equal(url.searchParams.get("email"), "Jane@Example.com");
    assert.equal(url.searchParams.get("reveal_phone_number"), "false");
    assert.equal(init.method, "POST");
    assert.equal(init.body, undefined);
    const headers = new Headers(init.headers);
    assert.equal(headers.get("X-Treg-Route-Max-Cost"), "0.05");
    assert.ok(headers.get("Idempotency-Key"));
    return json({
      person: {
        id: "123",
        name: "Jane",
        title: "Engineer",
        organization: { name: "Example" },
      },
    });
  })) as any;
  assert.equal(result.status, "found");
  assert.equal(result.person.name, "Jane");
  assert.equal(result.person.linkedin_url, null);
  assert.equal(result.person.company.domain, null);
  assert.equal(result.source.cost_usd, 0.026);
  assert.equal(result.source.call_id, "call-test");
});
test("distinguishes no match from malformed success responses", async () => {
  assert.equal(
    (
      (await enrich("jane@example.com", async () =>
        json({ person: null }),
      )) as any
    ).status,
    "not_found",
  );
  for (const body of [{}, { person: {} }, { person: [] }]) {
    assert.equal(
      ((await enrich("jane@example.com", async () => json(body))) as any).error
        .code,
      "unexpected_response",
    );
  }
});
test("reports HTTP failures with no retry and does not expose upstream error strings", async () => {
  for (const [status, code] of [
    [401, "authentication_failed"],
    [402, "balance_or_cost_limit"],
    [429, "rate_limited"],
    [500, "upstream_error"],
  ] as const) {
    let calls = 0;
    const result = (await enrich("jane@example.com", async () => {
      calls++;
      return json({ detail: "secret-marker" }, status);
    })) as any;
    assert.equal(calls, 1);
    assert.equal(result.error.code, code);
    assert.ok(!JSON.stringify(result).includes("secret-marker"));
  }
});
test("handles pending, invalid JSON and network failure", async () => {
  assert.equal(
    ((await enrich("jane@example.com", async () => json({}, 202))) as any).error
      .code,
    "pending",
  );
  assert.equal(
    (
      (await enrich(
        "jane@example.com",
        async () => new Response("invalid"),
      )) as any
    ).error.code,
    "request_failed",
  );
  assert.equal(
    (
      (await enrich("jane@example.com", async () => {
        throw new Error("secret-marker");
      })) as any
    ).error.code,
    "request_failed",
  );
});
