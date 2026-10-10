// Live meeting: browser mic audio -> Deepgram (server-side, key stays here) ->
// each final sentence is tagged with a topic -> for every employee, AgntID decides
// whether that employee's badge may receive the topic (meeting.<topic>_notes).
import WebSocket, { WebSocketServer } from "ws";

const TOPICS = ["finance", "marketing", "engineering", "people"];
const AUDIO_PORT = Number(process.env.BADGE_AUDIO_PORT || 8788);
const MEETING_URL = process.env.MEETING_URL || "http://localhost:8790";

export function startLiveMeeting({ emit, openai, model, connect, openBadge, parseCall, employees }) {
  // One AgntID task + badge per employee for the whole meeting.
  const badges = new Map();
  let mcpPromise = null;
  const mcp = () => (mcpPromise ??= connect("badge-meeting"));

  async function badgeFor(employee) {
    if (!badges.has(employee.id)) {
      badges.set(employee.id, openBadge(await mcp(), employee, "Listen to the leadership meeting for my role", "meeting"));
    }
    return badges.get(employee.id);
  }

  async function topicOf(text) {
    const res = await openai.chat.completions.create({
      model,
      reasoning_effort: process.env.OPENAI_REASONING ?? "none",
      messages: [
        {
          role: "system",
          content:
            "Classify one sentence from a startup leadership meeting. Reply with exactly one word: " +
            "finance (revenue, runway, fundraising, invoices, costs), marketing (launch, messaging, campaigns, customers), " +
            "engineering (infra, security, databases, code, migrations), or people (hiring, firing, salaries, HR).",
        },
        { role: "user", content: text },
      ],
    });
    const word = res.choices[0].message.content?.toLowerCase() ?? "";
    return TOPICS.find((t) => word.includes(t)) ?? "marketing";
  }

  async function route(text) {
    const id = `u-${Date.now()}`;
    const topic = await topicOf(text);
    emit({ type: "utterance", utterance: { id, text, topic } });
    await fetch(`${MEETING_URL}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, text }),
    }).catch(() => {});

    await Promise.all(
      employees.map(async (employee) => {
        const { taskId, delegationId } = await badgeFor(employee);
        const raw = await (await mcp()).call(`meeting_${topic}_notes`, {
          agntid_task_id: taskId,
          ...(delegationId ? { agntid_delegation_id: delegationId } : {}),
        });
        const result = parseCall(raw);
        emit({
          type: "route",
          route: { utterance: id, agent: employee.id, topic, verdict: result.verdict, reason: result.reason, steps: result.steps },
        });
        if (result.verdict !== "deny") {
          emit({ type: "heard", heard: { id: `${id}-${employee.id}`, agent: employee.id, topic, text } });
        }
      }),
    );
  }

  const queue = [];
  let draining = false;
  async function enqueue(text) {
    queue.push(text);
    if (draining) return;
    draining = true;
    while (queue.length) {
      try {
        await route(queue.shift());
      } catch (err) {
        emit({ type: "error", message: `meeting: ${err?.message ?? err}` });
      }
    }
    draining = false;
  }

  const wss = new WebSocketServer({ port: AUDIO_PORT });
  wss.on("connection", (client) => {
    const dg = new WebSocket(
      "wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&interim_results=true&endpointing=300&punctuate=true",
      { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } },
    );
    const pending = [];
    dg.on("open", () => pending.splice(0).forEach((c) => dg.send(c)));
    dg.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      const text = msg.channel?.alternatives?.[0]?.transcript?.trim();
      if (!text) return;
      if (msg.is_final) {
        client.send(JSON.stringify({ type: "final", text }));
        enqueue(text);
      } else {
        client.send(JSON.stringify({ type: "interim", text }));
      }
    });
    dg.on("error", (err) => client.send(JSON.stringify({ type: "error", message: String(err.message ?? err) })));
    dg.on("close", () => client.readyState === 1 && client.close());
    client.on("message", (data, isBinary) => {
      if (!isBinary) {
        // Typed fallback: {"type":"say","text":"..."} routes without audio.
        const msg = JSON.parse(String(data));
        if (msg.type === "say" && msg.text) enqueue(msg.text);
        return;
      }
      if (dg.readyState === 1) dg.send(data);
      else pending.push(data);
    });
    client.on("close", () => dg.readyState === 1 && dg.send(JSON.stringify({ type: "CloseStream" })));
  });
  console.log(`live meeting audio on ws://localhost:${AUDIO_PORT}`);
}
