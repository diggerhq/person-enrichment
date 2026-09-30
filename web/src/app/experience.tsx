"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Globe2,
  Layers3,
  Loader2,
  Mail,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  Webhook,
  Zap,
} from "lucide-react";

import {
  DEFAULT_ICP,
  FIT_LABELS,
  MAX_ICP_LENGTH,
  type Profile,
} from "@/lib/qualification";

const workflows = [
  {
    icon: Zap,
    name: "Signup qualification",
    event: "user.created",
    title: "Every signup has a story.",
    description:
      "Turn a new email address into a person, a company, and a little more context. Give your team a head start.",
    destination: "User database",
    output: "Profile + fit assessment",
    detail:
      "Connect your signup event, qualify the person against your ICP, then save the assessment to your user record.",
    code: '{ "event": "user.created",\n  "email": "alex@acme.com" }',
  },
  {
    icon: Mail,
    name: "Inbound qualification",
    event: "demo.requested",
    title: "Meet the person before the meeting.",
    description:
      "Add company and role context to every demo request. Build your own rules to route the right leads to the right rep.",
    destination: "Sales queue",
    output: "Lead context ready",
    detail:
      "Connect your demo form and add your qualification rules and CRM routing after enrichment.",
    code: '{ "event": "demo.requested",\n  "email": "alex@acme.com" }',
  },
  {
    icon: Database,
    name: "CRM enrichment",
    event: "contact.created",
    title: "Less research. Better records.",
    description:
      "Fill in the gaps when a contact enters your CRM. A name, a role, an employer — without another research tab.",
    destination: "CRM record",
    output: "Contact enriched",
    detail:
      "Connect a CRM webhook and map the enriched fields to your contact properties.",
    code: '{ "event": "contact.created",\n  "email": "alex@acme.com" }',
  },
  {
    icon: Sparkles,
    name: "Account signals",
    event: "trial.started",
    title: "Find the signal in your signups.",
    description:
      "Spot trials from companies that fit your market. Use returned company size and role to build a thoughtful sales alert.",
    destination: "Team alert",
    output: "Account context ready",
    detail:
      "Connect your trial event, define your ideal customer rules, and add a Slack or email destination.",
    code: '{ "event": "trial.started",\n  "email": "alex@acme.com" }',
  },
];
function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <i />
    </span>
  );
}
function Flow({ index }: { index: number }) {
  const w = workflows[index];
  const Icon = w.icon;
  return (
    <div
      className="flow"
      aria-label={`${w.name}: trigger, enrichment agent, ${w.destination}`}
    >
      <div className="flow-node">
        <span className="node-icon">
          <Icon size={19} />
        </span>
        <small>01 / TRIGGER</small>
        <strong>{w.event}</strong>
        <span>From your app</span>
      </div>
      <div className="wire">
        <span />
        <ChevronRight size={15} />
      </div>
      <div className="flow-node agent-node">
        <span className="node-icon">
          <Mark />
        </span>
        <small>02 / AGENT</small>
        <strong>Lead qualification</strong>
        <span>
          <i className="dot" /> OpenComputer + Treg
        </span>
      </div>
      <div className="wire">
        <span />
        <ChevronRight size={15} />
      </div>
      <div className="flow-node">
        <span className="node-icon">
          <CheckCheck size={19} />
        </span>
        <small>03 / YOUR NEXT STEP</small>
        <strong>{w.destination}</strong>
        <span>{w.output}</span>
      </div>
    </div>
  );
}
export default function Experience({
  deployUrl,
  repository,
}: {
  deployUrl: string;
  repository: string;
}) {
  const [icp, setIcp] = useState(DEFAULT_ICP);
  const [showTarget, setShowTarget] = useState(false);
  const [targetCopied, setTargetCopied] = useState(false);
  const [active, setActive] = useState(0),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<Profile | null>(null),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [json, setJson] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const workflow = workflows[active];
  async function run(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    setJson(false);
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, icp: icp.trim() || DEFAULT_ICP }),
        signal: controller.current.signal,
      });
      const body = await response.json();
      if (!response.ok || body.status === "error")
        throw new Error(
          (typeof body.error === "string" ? body.error : body.error?.message) ||
            "The agent could not finish. Please try again.",
        );
      setResult(body);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(
          e instanceof Error ? e.message : "Could not connect to the agent.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard unavailable. Select the text to copy it.");
    }
  }
  async function copyTarget(target = icp.trim() || DEFAULT_ICP) {
    try {
      await navigator.clipboard.writeText(target);
      setTargetCopied(true);
    } catch {
      setTargetCopied(false);
    }
  }
  const command = repository
    ? `npx @opencomputer/cli template deploy ${repository}`
    : "npm ci\nnpx opencomputer link --create-project person-enrichment\nnpx opencomputer deploy --alias production";
  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header>
        <div className="nav">
          <a className="wordmark" href="https://opencomputer.dev">
            opencomputer
            <span className="nav-divider" />
            <span className="nav-tag">GTM agents</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#workflows">Workflows</a>
            <a href="#playground">Try the agent</a>
            <a
              href="https://docs.opencomputer.dev/agents/quickstart"
              target="_blank"
              rel="noreferrer"
            >
              Docs <ArrowUpRight size={12} />
            </a>
          </nav>
          <a
            className="button small outline"
            href={deployUrl || "#deploy"}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              void copyTarget();
            }}
          >
            Deploy template <ArrowUpRight size={13} />
          </a>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-grid">
            <div className="hero-copy">
              <h1>
                Who’s your next
                <br />
                <span>customer?</span>
              </h1>
              <p>
                One email. A sourced profile. A clear assessment against your
                ideal customer — with reasons, not guesses.
              </p>
              <ol className="hero-steps">
                <li>
                  <span>01</span>
                  <div>
                    <h2>Know the person.</h2>
                    <p>A person, a role, and a company from one email.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h2>Find the fit.</h2>
                    <p>Compare their role and company with your target.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h2>Deploy it.</h2>
                    <p>Your own serverless agent. Your rules and next steps.</p>
                  </div>
                </li>
              </ol>
              <div className="hero-actions">
                <a className="button" href="#playground">
                  Qualify a lead <ArrowRight size={15} />
                </a>
                <a
                  className="text-link"
                  href={deployUrl || "#deploy"}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    void copyTarget();
                  }}
                >
                  Deploy the template ↗
                </a>
              </div>
              <p className="hero-caption">
                Your managed API keys stay outside the runtime.
              </p>
            </div>
            <div className="demo-card" id="playground">
              <div className="card-title">
                <span>
                  <Mail size={15} /> Is this person a fit?
                </span>
                <span className="live-label">
                  <i className="dot" /> LIVE AGENT
                </span>
              </div>
              <form onSubmit={run}>
                <label htmlFor="email">Email address</label>
                <div className="input-row">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    placeholder="alex@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    autoComplete="off"
                  />
                  <button className="button" disabled={busy} type="submit">
                    {busy ? (
                      <Loader2 size={15} className="spin" />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                    <span>{busy ? "Qualifying" : "Qualify lead"}</span>
                  </button>
                </div>
                <div className="target-summary">
                  <p>
                    <span>Looking for:</span> {icp.trim() || DEFAULT_ICP}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTarget(!showTarget)}
                    aria-expanded={showTarget}
                    aria-controls="target-editor"
                    disabled={busy}
                  >
                    {showTarget ? "Done" : "Change target"}
                  </button>
                </div>
                {showTarget && (
                  <div className="target-editor" id="target-editor">
                    <label htmlFor="icp">Describe your ideal customer</label>
                    <textarea
                      id="icp"
                      value={icp}
                      maxLength={MAX_ICP_LENGTH}
                      onChange={(e) => {
                        setIcp(e.target.value);
                        setTargetCopied(false);
                      }}
                      disabled={busy}
                      rows={3}
                      placeholder="Founders or engineering leaders at US software companies with 10–200 employees."
                    />
                    <p>
                      Include a role, industry, company size, or location.
                      Missing facts stay unknown.
                    </p>
                  </div>
                )}
                <p className="form-note">
                  Free to try. 100 lookups per day · up to 5 running per IP.
                </p>
              </form>
              <div className="result-area" aria-live="polite" aria-busy={busy}>
                {busy ? (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Loader2 className="spin" size={23} />
                    </span>
                    <h3>Your agent is on it.</h3>
                    <p>
                      Enriching the profile and checking your target.
                      <br />
                      The first run can take a minute.
                    </p>
                  </div>
                ) : error ? (
                  <div className="error-state">
                    <strong>Couldn’t complete this lookup</strong>
                    <p>{error}</p>
                  </div>
                ) : result?.qualification ? (
                  <>
                    <div className="assessment">
                      <span className={`fit-label ${result.qualification.fit}`}>
                        {FIT_LABELS[result.qualification.fit]}
                      </span>
                      {result.person && (
                        <div className="lead-identity">
                          <h3>{result.person.name || result.email}</h3>
                          <p>
                            {result.person.title || "Role not returned"}
                            {result.person.company?.name
                              ? ` at ${result.person.company.name}`
                              : ""}
                          </p>
                        </div>
                      )}
                      <p className="assessment-summary">
                        {result.qualification.summary}
                      </p>
                      {result.qualification.reasons.length > 0 && (
                        <ul className="fit-reasons">
                          {result.qualification.reasons
                            .slice(0, 3)
                            .map((reason, i) => (
                              <li key={i}>
                                <Check size={13} />
                                <span>{reason}</span>
                              </li>
                            ))}
                        </ul>
                      )}
                      <div className="fit-unknowns">
                        <span>Unknown</span>
                        <p>
                          {result.qualification.unknowns.slice(0, 3).join(" ")}
                        </p>
                      </div>
                      <div className="next-action">
                        <span>Suggested next step</span>
                        <p>{result.qualification.next_action}</p>
                      </div>
                    </div>
                    <details className="profile-details">
                      <summary>View details</summary>
                      <dl>
                        <div>
                          <dt>Target used</dt>
                          <dd>{result.icp}</dd>
                        </div>
                        <div>
                          <dt>Company</dt>
                          <dd>
                            {result.person?.company?.name || "Not returned"}
                          </dd>
                        </div>
                        <div>
                          <dt>Location</dt>
                          <dd>
                            {[
                              result.person?.location.city,
                              result.person?.location.country,
                            ]
                              .filter(Boolean)
                              .join(", ") || "Not returned"}
                          </dd>
                        </div>
                        <div>
                          <dt>Company size</dt>
                          <dd>
                            {result.person?.company?.employee_count != null
                              ? `${result.person.company.employee_count.toLocaleString()} employees`
                              : "Not returned"}
                          </dd>
                        </div>
                        <div>
                          <dt>Industry</dt>
                          <dd>
                            {result.person?.company?.industry || "Not returned"}
                          </dd>
                        </div>
                        <div>
                          <dt>Domain</dt>
                          <dd>
                            {result.person?.company?.domain || "Not returned"}
                          </dd>
                        </div>
                        <div>
                          <dt>LinkedIn</dt>
                          <dd>
                            {result.person?.linkedin_url &&
                            /^https?:\/\/(www\.)?linkedin\.com\//i.test(
                              result.person.linkedin_url,
                            ) ? (
                              <a
                                href={result.person.linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View profile ↗
                              </a>
                            ) : (
                              "Not returned"
                            )}
                          </dd>
                        </div>
                      </dl>
                      <div className="criteria-details">
                        {result.qualification.criteria.map((criterion, i) => (
                          <div key={i}>
                            <span
                              className={`criterion-result ${criterion.result}`}
                            >
                              {criterion.result}
                            </span>
                            <strong>{criterion.criterion}</strong>
                            <p>{criterion.explanation}</p>
                          </div>
                        ))}
                      </div>
                      <div className="result-meta">
                        <span>
                          Treg / Apollo
                          {result.source?.cost_usd != null
                            ? ` · $${result.source.cost_usd.toFixed(3)}`
                            : ""}
                        </span>
                        <button onClick={() => setJson(!json)}>
                          {json ? "Hide JSON" : "View JSON"}
                          <Code2 size={12} />
                        </button>
                      </div>
                      {json && (
                        <pre className="json-output">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      )}
                    </details>
                    <div className="result-deploy">
                      <a
                        className="button"
                        href={deployUrl || "#deploy"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          void copyTarget(result.icp);
                        }}
                      >
                        Deploy this agent <ArrowUpRight size={13} />
                      </a>
                      <p>
                        {targetCopied
                          ? "Target copied. Paste it into the ICP field during deployment."
                          : "Your account. Your Treg key. This target is copied when you deploy."}
                      </p>
                    </div>
                  </>
                ) : result ? (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Mail size={23} />
                    </span>
                    <h3>
                      {result.status === "not_found"
                        ? "No match this time."
                        : "Lookup needs attention."}
                    </h3>
                    <p>
                      {result.error?.message ||
                        "The provider didn’t return a person for this email. Try another address."}
                    </p>
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Layers3 size={23} />
                    </span>
                    <h3>Get to know your next customer.</h3>
                    <p>
                      Enter an email to see how they fit your target.
                      <br />
                      No signup or setup required.
                    </p>
                    <div className="empty-fields">
                      <span>Fit</span>
                      <span>Reasons</span>
                      <span>Unknowns</span>
                      <span>Next step</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="demo-footer">
                <ShieldCheck size={12} />
                <span>
                  Your email is sent to Treg and its enrichment provider.
                </span>
              </div>
            </div>
          </div>
          <div className="workflow-intro">
            <span className="section-kicker">START WITH A WORKING AGENT</span>
            <h2>What will you automate first?</h2>
            <p>
              Enrich, assess, and suggest the next step. Make this agent part of
              your GTM workflows.
            </p>
          </div>
          <div className="workflow-window" id="workflows">
            <div className="window-top">
              <span className="traffic">
                <i />
                <i />
                <i />
              </span>
              <span>gtm / person-enrichment</span>
              <span className="window-status">
                <i className="dot" /> TEMPLATE
              </span>
            </div>
            <div
              className="workflow-tabs"
              role="tablist"
              aria-label="GTM workflows"
            >
              {workflows.map((w, i) => (
                <button
                  key={w.name}
                  role="tab"
                  id={`tab-${i}`}
                  aria-selected={active === i}
                  aria-controls="workflow-panel"
                  onClick={() => setActive(i)}
                  className={active === i ? "selected" : ""}
                >
                  <w.icon size={14} />
                  {w.name}
                </button>
              ))}
            </div>
            <div
              id="workflow-panel"
              role="tabpanel"
              aria-labelledby={`tab-${active}`}
            >
              <Flow index={active} />
              <div className="flow-bottom">
                <span>
                  <Layers3 size={13} /> {workflow.detail}
                </span>
                <span className="mono">01 agent · endless possibilities</span>
              </div>
            </div>
          </div>
        </section>
        <section className="work-section container">
          <div className="section-kicker">BUILD ON THE TEMPLATE</div>
          <div className="section-row">
            <h2>{workflow.title}</h2>
            <p>{workflow.description}</p>
          </div>
          <div className="benefit-grid">
            <article>
              <Globe2 size={21} />
              <h3>One email. More context.</h3>
              <p>
                Name, role, company, and location — returned when available,
                with a source and cost.
              </p>
            </article>
            <article>
              <Webhook size={21} />
              <h3>Fits your existing flow.</h3>
              <p>
                Invoke from your app. Connect signup events, demo requests, or
                CRM webhooks to your own workflow.
              </p>
            </article>
            <article>
              <Code2 size={21} />
              <h3>A starting point you own.</h3>
              <p>
                Deploy the enrichment agent, then add your qualification rules,
                destinations, and business logic.
              </p>
            </article>
          </div>
        </section>
        <section className="container deployment" id="deploy">
          <div>
            <span className="section-kicker">GET STARTED</span>
            <h2>
              Make it yours.
              <br />
              <span>Put it to work.</span>
            </h2>
            <p>
              Deploy the template to your OpenComputer account. Bring your Treg
              key, connect your trigger, and add what happens next.
            </p>
            <a
              className="button"
              href={deployUrl || "https://app.opencomputer.dev"}
              onClick={() => {
                void copyTarget();
              }}
              target="_blank"
              rel="noreferrer"
            >
              {deployUrl ? "Deploy template" : "Open OpenComputer"}
              <Rocket size={15} />
            </a>
            <p className="deploy-note">
              {deployUrl
                ? "Your account · your credentials · your production agent"
                : "Local template ready. Publish the repository to enable one-click deployment."}
            </p>
          </div>
          <div className="deploy-panel">
            <div className="deploy-target">
              <span>Your target</span>
              <p>{icp.trim() || DEFAULT_ICP}</p>
              <button
                type="button"
                onClick={() => {
                  void copyTarget();
                }}
              >
                {targetCopied
                  ? "Copied — paste into ICP during deployment"
                  : "Copy target for deployment"}
                <Copy size={13} />
              </button>
            </div>
            <div className="deploy-step">
              <span>01</span>
              <div>
                <h3>Deploy your agent</h3>
                <p>Install the template in your own workspace.</p>
              </div>
            </div>
            <div className="command">
              <code>{command}</code>
              <button
                onClick={() => copy(command)}
                aria-label="Copy deployment command"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <div className="deploy-step">
              <span>02</span>
              <div>
                <h3>Bring your enrichment key</h3>
                <p>
                  The template asks for your Treg token. For identity tokens,
                  add your organization slug.
                </p>
              </div>
            </div>
            <div className="deploy-step">
              <span>03</span>
              <div>
                <h3>Connect a trigger. Choose the next step.</h3>
                <p>
                  Send an email from your app, then write the result to a
                  database, route a lead, or notify your team.
                </p>
              </div>
            </div>
            <div className="event-sample">
              <span>
                <Webhook size={13} /> Example trigger payload
              </span>
              <pre>{workflow.code}</pre>
            </div>
            {repository && (
              <a
                className="source-link"
                href={repository}
                target="_blank"
                rel="noreferrer"
              >
                Explore the source <ArrowUpRight size={13} />
              </a>
            )}
          </div>
        </section>
        <section className="last-line container">
          <span className="last-icon">
            <Zap size={23} />
          </span>
          <h2>
            Less manual work.
            <br />
            More momentum.
          </h2>
          <p>Your GTM stack has the events. Give it an agent.</p>
          <a className="text-link" href="#playground">
            Start with an email <ArrowRight size={15} />
          </a>
        </section>
      </main>
      <footer className="container">
        <a className="wordmark" href="https://opencomputer.dev">
          <Mark />
          opencomputer
        </a>
        <span>A computer for every agent.</span>
        <div>
          <a href="https://treg.to">Treg ↗</a>
          <a href="https://docs.opencomputer.dev/agents/quickstart">
            Documentation ↗
          </a>
          {repository && <a href={repository}>Source ↗</a>}
        </div>
      </footer>
    </>
  );
}
