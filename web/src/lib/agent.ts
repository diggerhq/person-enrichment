import { validateQualification } from "./qualification";
import { randomUUID } from "node:crypto";
const API = process.env.OPENCOMPUTER_API_URL || "https://app.opencomputer.dev";
type Event = { seq: number; type: string; data: Record<string, unknown> };
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.OPENCOMPUTER_API_KEY;
  if (!key) throw new Error("The live agent is not configured yet.");
  const response = await fetch(`${API}/api/managed-agents${path}`, {
    ...init,
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      `The cloud agent service returned HTTP ${response.status}.`,
    );
  return response.json();
}
export async function runEnrichment(email: string, icp: string) {
  const created = await request<{ session: { id: string } }>("/sessions", {
    method: "POST",
    body: JSON.stringify({
      agentId: process.env.OC_AGENT_ID || "person-enrichment@production",
    }),
  });
  const id = encodeURIComponent(created.session.id);
  let cursor = 0,
    started = false,
    completedText = "",
    streamedText = "";
  const deadline = Date.now() + 150000;
  try {
    while (Date.now() < deadline) {
      const { events } = await request<{ events: Event[] }>(
        `/sessions/${id}/events?after=${cursor}`,
      );
      for (const event of events) {
        cursor = Math.max(cursor, event.seq);
        if (event.type === "runtime.connected" && !started) {
          await request(`/sessions/${id}/turns`, {
            method: "POST",
            body: JSON.stringify({
              input: JSON.stringify({ email, icp }),
              idempotencyKey: randomUUID(),
            }),
          });
          started = true;
        }
        if (
          event.type === "message.delta" &&
          typeof event.data.text === "string"
        )
          streamedText += event.data.text;
        if (
          event.type === "message.completed" &&
          typeof event.data.text === "string"
        )
          completedText = event.data.text;
        if (
          event.type === "turn.failed" ||
          event.type === "runtime.disconnected"
        )
          throw new Error("The cloud agent could not finish this lookup.");
        if (event.type === "turn.completed") {
          const text = (completedText || streamedText)
            .trim()
            .replace(/^```(?:json)?\s*/, "")
            .replace(/\s*```$/, "");
          let result;
          try {
            result = JSON.parse(text);
          } catch {
            throw new Error("The agent returned an unexpected response.");
          }
          return validateQualification(result, email, icp);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    throw new Error(
      "The agent took too long. The lookup may still have completed; avoid immediately repeating it.",
    );
  } finally {
    await request(`/sessions/${id}/end`, { method: "POST" }).catch(
      () => undefined,
    );
  }
}
