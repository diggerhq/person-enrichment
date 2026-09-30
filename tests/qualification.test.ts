import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ICP,
  normalizeIcp,
  validateQualification,
} from "../web/src/lib/qualification.js";
const email = "alex@example.com";
function result() {
  return {
    status: "found",
    email,
    person: {
      name: "Alex Example",
      title: "VP Engineering",
      linkedin_url: null,
      location: { city: "London", region: null, country: "UK" },
      company: {
        name: "Example",
        domain: "example.com",
        industry: "Software",
        employee_count: 50,
      },
    },
    source: { cost_usd: 0.026, call_id: "test-call" },
    error: null,
    qualification: {
      fit: "strong_fit",
      summary: "The role and industry match your target.",
      next_action: "Review the account for a personal welcome.",
      criteria: [
        {
          criterion: "Engineering leader",
          result: "match",
          explanation: "VP Engineering is a leadership role.",
          evidence: [{ field: "title", value: "VP Engineering" }],
        },
        {
          criterion: "Software company",
          result: "match",
          explanation: "The provider lists the industry as Software.",
          evidence: [{ field: "company.industry", value: "Software" }],
        },
      ],
    },
  };
}
test("defaults to the simple ICP and rejects oversized or non-text targets", () => {
  for (const value of [undefined, null, "", "   "])
    assert.equal(normalizeIcp(value), DEFAULT_ICP);
  assert.equal(
    normalizeIcp("  Software founders in Canada.  "),
    "Software founders in Canada.",
  );
  for (const value of [12, {}, [], "x".repeat(1001)])
    assert.throws(() => normalizeIcp(value));
});
test("returns strong fit only for complete matching evidence and preserves the caller's ICP", () => {
  const input = result();
  const output = validateQualification(input, email, DEFAULT_ICP);
  assert.equal(output.qualification?.fit, "strong_fit");
  assert.equal(output.icp, DEFAULT_ICP);
  assert.equal(output.qualification?.reasons.length, 2);
  assert.deepEqual(output.person, input.person);
  assert.ok(
    output.qualification?.unknowns.some((s) => s.includes("Buying intent")),
  );
});
test("missing evidence stays unknown and produces possible fit rather than a rejection", () => {
  const input = result();
  input.qualification.fit = "possible_fit";
  input.qualification.criteria[1] = {
    criterion: "Software company",
    result: "unknown",
    explanation: "The provider did not return an industry.",
    evidence: [],
  };
  input.person.company.industry = null as any;
  const output = validateQualification(input, email, DEFAULT_ICP);
  assert.equal(output.qualification?.fit, "possible_fit");
  assert.ok(output.qualification?.unknowns.some((s) => s.includes("industry")));
});
test("an evidenced mismatch supports low fit", () => {
  const input = result();
  input.person.title = "Product Designer";
  input.qualification.fit = "low_fit";
  input.qualification.criteria[0] = {
    criterion: "Engineering leader",
    result: "mismatch",
    explanation:
      "The returned role is Product Designer, not an engineering leadership role.",
    evidence: [{ field: "title", value: "Product Designer" }],
  };
  assert.equal(
    validateQualification(input, email, DEFAULT_ICP).qualification?.fit,
    "low_fit",
  );
});
test("refuses verdicts that contradict criteria and evidence invented or outside the profile", () => {
  const guessed = result();
  guessed.qualification.criteria[0].evidence[0].value = "CTO";
  assert.throws(
    () => validateQualification(guessed, email, DEFAULT_ICP),
    /unsupported evidence/,
  );
  const missing = result();
  missing.qualification.criteria[0].evidence = [];
  assert.throws(
    () => validateQualification(missing, email, DEFAULT_ICP),
    /missing its evidence/,
  );
  const contradicted = result();
  contradicted.qualification.fit = "low_fit";
  assert.throws(
    () => validateQualification(contradicted, email, DEFAULT_ICP),
    /conflicts/,
  );
  const secret = result();
  secret.qualification.criteria[0].evidence[0].field = "api_key";
  assert.throws(
    () => validateQualification(secret, email, DEFAULT_ICP),
    /unsupported evidence/,
  );
});
test("no profile is insufficient data; API errors are not qualification decisions", () => {
  const missing = {
    ...result(),
    status: "not_found",
    person: null,
    qualification: {
      fit: "insufficient_data",
      summary: "No profile was returned.",
      next_action: "Ask for role and company details.",
      criteria: [
        {
          criterion: "Profile coverage",
          result: "unknown",
          explanation: "The provider did not return a profile.",
          evidence: [],
        },
      ],
    },
  };
  assert.equal(
    validateQualification(missing, email, DEFAULT_ICP).qualification?.fit,
    "insufficient_data",
  );
  const error = {
    status: "error",
    email,
    person: null,
    source: null,
    error: { message: "Treg returned HTTP 402." },
  };
  assert.equal(
    validateQualification(error, email, DEFAULT_ICP).qualification,
    null,
  );
  assert.throws(
    () => validateQualification(result(), "other@example.com", DEFAULT_ICP),
    /incomplete result/,
  );
});
