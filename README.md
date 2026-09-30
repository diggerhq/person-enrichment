# Person Enrichment

[Live GTM workflow UI](https://gtm-enrichment-agent.vercel.app) · [Deploy the template](https://app.opencomputer.dev/new?repository-url=https%3A%2F%2Fgithub.com%2Fdiggerhq%2Fperson-enrichment)

An OpenComputer serverless agent that accepts one email address and enriches the person through [Treg](https://treg.to/), using its `apollo.people.enrich` catalog endpoint. Returns name, role, employer, company details, location and LinkedIn URL when present, plus the Treg call ID and actual cost. Unknown fields remain `null`.

## Deploy as a template

This repository contains `oc-template.toml`, following [ShipVideo](https://github.com/diggerhq/shipvideo)'s template pattern. Deploy the published template:

```sh
npx @opencomputer/cli@0.7.13 template deploy https://github.com/diggerhq/person-enrichment
```

For a one-click deployment button, use:

```text
https://app.opencomputer.dev/new?repository-url=https%3A%2F%2Fgithub.com%2Fdiggerhq%2Fperson-enrichment
```

Deployment asks each user for their own **TREG_API_KEY**. Use an organization token from Treg, or supply an identity token and set `TREG_ORG` to your organization slug. The secret is injected into the `X-Treg-Token` header by the OpenComputer connection, restricted to `https://treg.to`; it is not included in prompts or source. The first run asks for an email before making a paid lookup.

The template deploys the enrichment agent. External trigger and destination integrations are configured separately.

## Deploy from this directory

```sh
npm ci
npm run build
npm test
npm run check:template
npx opencomputer login
npx opencomputer link --create-project person-enrichment
npx opencomputer secrets set TREG_API_KEY --agent current --value-stdin
# Paste your Treg organization token, then press Ctrl-D.
# For identity tokens, also configure the organization slug:
npx opencomputer env set TREG_ORG --agent current --value-stdin
# Paste your organization slug, then press Ctrl-D.
npm run deploy
npx opencomputer session 'Enrich jane@example.com'
```

The example address above is a placeholder: replace it with the person you want to enrich. Configure the secret again with `--environment production` when deploying the production alias.

You can also use the OpenComputer playground. Text input can be a bare email or a sentence containing one email. Programmatic turns can supply `{ "email": "jane@example.com" }` as their payload.

## Behavior and costs

The tool validates the email, issues one POST with email in the query string (as required by [Treg's endpoint contract](https://treg.to/catalog/endpoints/apollo.people.enrich)), and normalizes Apollo's `person` response. It uses a 30-second timeout, an idempotency key and a $0.05 per-call spending ceiling. Phone reveal, personal-email reveal and provider waterfalls are disabled. No retries or provider fallback run automatically.

Statuses are `found`, `not_found` (explicit provider `person: null`), and `error`. Authentication, credits/cost ceiling, rate limit, malformed responses and network errors remain errors rather than being presented as a missing person. A returned `email_status` is provider metadata, not a new deliverability check. The agent's final JSON is model-generated; integrations needing strict machine-readable data should validate it or consume the tool result.

Treg/provider charges and OpenComputer model/runtime charges are separate. Current Treg prices are available in the endpoint catalog; actual Treg spend comes from the response header.

## Files

- `opencomputer/project.ts`: project and agent list.
- `opencomputer/agents/enricher/agent.ts`: input and response instructions.
- `opencomputer/agents/enricher/tools/treg.ts`: secret-backed connection and tool.
- `opencomputer/agents/enricher/tools/enrichment.ts`: request, validation and normalization.
- `oc-template.toml`: reusable deployment metadata and required key.
- `tests/enrichment.test.ts`: offline provider-contract and failure-path checks.

Live enrichment has been verified with Treg and the deployed OpenComputer agent. Your own deployment requires your Treg key. `.env.example` provides an optional local location for sharing the key during setup; the deployed agent uses OpenComputer secrets, not dotenv.

## GTM workflow UI

`web/` contains a Next.js UI based on the OpenComputer site's design. It includes interactive signup, inbound qualification, CRM and trial workflow examples, a live enrichment form, and a template deployment section. The examples explain the integrations you add; only person enrichment is included out of the box.

```sh
cd web
npm ci
# Configure web/.env.local using web/.env.example
npm run dev
```

Open http://localhost:3012. The API creates a session for the deployed OpenComputer agent, waits for the JSON result, and ends the session. Set `OPENCOMPUTER_API_KEY` and `OC_AGENT_ID` server-side. No Treg credential is needed in the web app. Set `TEMPLATE_REPOSITORY_URL` to the published repository URL to activate the one-click deploy button.

The public demo accepts emails without an access code. A shared PostgreSQL store enforces a global limit of **100 admitted requests per UTC day** and **5 concurrent requests per IP**, across every server instance and deployment. Failed admitted requests still count toward the daily cap to bound spend. Invalid emails and limit rejections do not consume slots. Slots are released in `finally`; abandoned leases expire after 240 seconds, beyond the 180-second route lifetime. IPs are taken from Vercel's trusted forwarded header and stored only as HMAC hashes. If the store is unavailable, the API returns 503 without starting an agent.

Set `GTM_DATABASE_URL` server-side, then initialize the isolated schema:

```sh
node --env-file=web/.env.local --import tsx scripts/setup-limits.ts
node --env-file=web/.env.local --import tsx scripts/check-shared-limits.ts
```

The second command runs concurrent admission tests in temporary isolated scopes and cleans them up. It makes no paid enrichment calls. The database function takes a transaction-scoped advisory lock before checking and reserving both allowances. Run schema setup before deploying a fresh copy of the UI. The signup/CRM/notification connectors remain integration work for users deploying their own agent.
