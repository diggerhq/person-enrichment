export const DEFAULT_ICP = "Engineering leaders at software companies.";
export const MAX_ICP_LENGTH = 1000;
export const FIT_LABELS = {
  strong_fit: "Strong fit",
  possible_fit: "Possible fit",
  low_fit: "Low fit",
  insufficient_data: "Insufficient data",
} as const;
export type Fit = keyof typeof FIT_LABELS;
export type Criterion = {
  criterion: string;
  result: "match" | "mismatch" | "unknown";
  explanation: string;
  evidence: { field: string; value: string | number }[];
};
export type Qualification = {
  fit: Fit;
  summary: string;
  criteria: Criterion[];
  reasons: string[];
  unknowns: string[];
  next_action: string;
};
export type Profile = {
  status: "found" | "not_found" | "error";
  email: string;
  icp: string;
  person: null | {
    name: string | null;
    title: string | null;
    linkedin_url: string | null;
    location: {
      city: string | null;
      region: string | null;
      country: string | null;
    };
    company: null | {
      name: string | null;
      domain: string | null;
      industry: string | null;
      employee_count: number | null;
    };
  };
  source: { cost_usd: number | null; call_id: string | null } | null;
  error: { message: string } | null;
  qualification: Qualification | null;
};
const FIELDS = new Set([
  "title",
  "company.name",
  "company.industry",
  "company.employee_count",
  "location.city",
  "location.region",
  "location.country",
]);
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const text = (x: unknown, max = 1000): x is string =>
  typeof x === "string" && !!x.trim() && x.length <= max;
export function normalizeIcp(input: unknown): string {
  if (input === undefined || input === null || input === "") return DEFAULT_ICP;
  if (typeof input !== "string" || input.trim().length > MAX_ICP_LENGTH)
    throw new Error("Describe your target in 1,000 characters or fewer.");
  return input.trim() || DEFAULT_ICP;
}
function evidenceValue(person: unknown, field: string): unknown {
  return field
    .split(".")
    .reduce<unknown>(
      (value, key) => (object(value) ? value[key] : undefined),
      person,
    );
}
export function validateQualification(
  value: unknown,
  email: string,
  icp: string,
): Profile {
  if (
    !object(value) ||
    !["found", "not_found", "error"].includes(String(value.status)) ||
    value.email !== email
  )
    throw new Error("The agent returned an incomplete result.");
  if (value.status === "error") {
    if (!object(value.error) || !text(value.error.message))
      throw new Error("The agent returned an incomplete error.");
    return { ...value, icp, qualification: null } as Profile;
  }
  if (
    !object(value.source) ||
    (value.status === "found" &&
      (!object(value.person) || !object(value.person.location))) ||
    (value.status === "not_found" && value.person !== null)
  )
    throw new Error("The agent returned an incomplete profile.");
  const q = value.qualification;
  if (
    !object(q) ||
    !text(q.summary) ||
    !text(q.next_action) ||
    !Array.isArray(q.criteria) ||
    q.criteria.length < 1 ||
    q.criteria.length > 20
  )
    throw new Error("The agent returned an incomplete assessment.");
  const criteria: Criterion[] = q.criteria.map((c) => {
    if (
      !object(c) ||
      !text(c.criterion, 500) ||
      !text(c.explanation) ||
      !["match", "mismatch", "unknown"].includes(String(c.result)) ||
      !Array.isArray(c.evidence) ||
      c.evidence.length > 10
    )
      throw new Error("The agent returned invalid criteria.");
    if (c.result !== "unknown" && !c.evidence.length)
      throw new Error("The assessment is missing its evidence.");
    for (const e of c.evidence) {
      if (
        !object(e) ||
        typeof e.field !== "string" ||
        !FIELDS.has(e.field) ||
        !(
          text(e.value) ||
          (typeof e.value === "number" && Number.isFinite(e.value))
        ) ||
        evidenceValue(value.person, e.field) !== e.value
      )
        throw new Error("The assessment cites unsupported evidence.");
    }
    return c as unknown as Criterion;
  });
  const fit: Fit =
    value.status === "not_found"
      ? "insufficient_data"
      : criteria.some((c) => c.result === "mismatch")
        ? "low_fit"
        : criteria.every((c) => c.result === "match")
          ? "strong_fit"
          : criteria.some((c) => c.result === "match")
            ? "possible_fit"
            : "insufficient_data";
  if (q.fit !== fit)
    throw new Error("The assessment verdict conflicts with its evidence.");
  if (
    value.status === "not_found" &&
    criteria.some((c) => c.result !== "unknown")
  )
    throw new Error("A missing profile cannot support a fit decision.");
  return {
    ...value,
    icp,
    qualification: {
      fit,
      summary: q.summary,
      criteria,
      reasons: criteria
        .filter((c) => c.result !== "unknown")
        .map((c) => c.explanation),
      unknowns: [
        ...criteria
          .filter((c) => c.result === "unknown")
          .map((c) => c.explanation),
        "Buying intent is not established by enrichment.",
      ],
      next_action: q.next_action,
    },
  } as Profile;
}
