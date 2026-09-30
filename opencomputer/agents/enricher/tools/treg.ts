import {
  defineConnection,
  defineTool,
  secretHeader,
  useSecret,
} from "@opencomputer/agent";
import { enrich } from "./enrichment.js";

const treg = defineConnection({
  id: "treg",
  origin: "https://treg.to",
  methods: ["POST"],
  pathPrefix: "/call/apollo.people.enrich",
  headers: { "X-Treg-Token": secretHeader(useSecret("TREG_API_KEY")) },
});

export const enrichPerson = defineTool({
  name: "enrich_person",
  description:
    "Enrich a single email through Treg's Apollo endpoint. Returns profile, provenance, actual cost, or a structured error. One call, capped at $0.05.",
  input: {
    type: "object",
    properties: { email: { type: "string", format: "email", maxLength: 254 } },
    required: ["email"],
    additionalProperties: false,
  },
  async run({ input, signal }) {
    return enrich(
      input.email,
      (path, init) => {
        const headers = new Headers(init.headers);
        const org = process.env.TREG_ORG?.trim();
        if (org) headers.set("X-Treg-Org", org);
        return treg.fetch(path, { ...init, headers });
      },
      signal,
    );
  },
});
