import { randomUUID } from "node:crypto";
import type { DataValue } from "@opencomputer/agent";

type Fetcher = (path: string, init: RequestInit) => Promise<Response>;
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const string = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

export async function enrich(
  emailInput: unknown,
  fetcher: Fetcher,
  signal?: AbortSignal,
): Promise<DataValue> {
  const email = typeof emailInput === "string" ? emailInput.trim() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      status: "error",
      email,
      person: null,
      source: null,
      error: {
        code: "invalid_email",
        message: "Provide one valid email address.",
      },
    };
  }
  const source: Record<string, DataValue> = {
    service: "treg",
    endpoint: "apollo.people.enrich",
    retrieved_at: new Date().toISOString(),
    call_id: null,
    cost_usd: null,
  };
  const fail = (code: string, message: string): DataValue => ({
    status: "error",
    email,
    person: null,
    source,
    error: { code, message },
  });
  try {
    const timeout = AbortSignal.timeout(30000);
    const response = await fetcher(
      `/call/apollo.people.enrich?${new URLSearchParams({ email, reveal_personal_emails: "false", reveal_phone_number: "false", run_waterfall_email: "false", run_waterfall_phone: "false" })}`,
      {
        method: "POST",
        redirect: "error",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: {
          Accept: "application/json",
          "Idempotency-Key": randomUUID(),
          "X-Treg-Route-Max-Cost": "0.05",
        },
      },
    );
    source.call_id = response.headers.get("X-Treg-Call-Id");
    const micro = response.headers.get("X-Treg-Cost-Micro");
    source.cost_usd =
      micro !== null && /^\d+$/.test(micro) ? Number(micro) / 1000000 : null;
    if (!response.ok) {
      const codes: Record<number, string> = {
        401: "authentication_failed",
        403: "access_denied",
        402: "balance_or_cost_limit",
        429: "rate_limited",
      };
      return fail(
        codes[response.status] ?? "upstream_error",
        `Treg returned HTTP ${response.status}. Check the Treg dashboard using the call ID; no automatic retry was made.`,
      );
    }
    if (response.status === 202)
      return fail(
        "pending",
        "The provider returned a pending result. Do not submit the lookup again.",
      );
    const body = object(await response.json());
    if (!body || !("person" in body))
      return fail(
        "unexpected_response",
        "Treg returned an unrecognized Apollo response.",
      );
    if (body.person === null)
      return { status: "not_found", email, person: null, source, error: null };
    const person = object(body.person);
    if (!person || (!string(person.id) && !string(person.name)))
      return fail(
        "unexpected_response",
        "The provider returned an invalid person record.",
      );
    const company = object(person.organization);
    return {
      status: "found",
      email,
      error: null,
      source,
      person: {
        name: string(person.name),
        first_name: string(person.first_name),
        last_name: string(person.last_name),
        title: string(person.title),
        linkedin_url: string(person.linkedin_url),
        email_status: string(person.email_status),
        location: {
          city: string(person.city),
          region: string(person.state),
          country: string(person.country),
        },
        company: company
          ? {
              name: string(company.name),
              domain: string(company.primary_domain),
              website: string(company.website_url),
              industry: string(company.industry),
              employee_count:
                typeof company.estimated_num_employees === "number"
                  ? company.estimated_num_employees
                  : null,
            }
          : null,
      },
    };
  } catch {
    return fail(
      "request_failed",
      "The enrichment request timed out, was cancelled, or returned invalid JSON. No automatic retry was made.",
    );
  }
}
