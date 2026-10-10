// Live meeting: browser mic audio -> Deepgram (server-side, key stays here) ->
// each final sentence is tagged with a topic -> for every employee, AgntID decides
// whether that employee's badge may receive the topic (meeting.<topic>_notes).
import WebSocket, { WebSocketServer } from "ws";

const TOPICS = ["finance", "marketing", "engineering", "people"];
const AUDIO_PORT = Number(process.env.BADGE_AUDIO_PORT || 8788);
const MEETING_URL = process.env.MEETING_URL || "http://localhost:8790";

const TOPIC_EMOJI = { finance: "💰", marketing: "📣", engineering: "🛠️", people: "🔒" };

export function startLiveMeeting({ emit, openai, model, connect, openBadge, parseCall, notionPageArgs, employees }) {
  // AgntID expires idle tasks, so each employee's meeting badge is reused for at
  // most 30s and then reopened.
  const BADGE_TTL_MS = 30_000;
  const badges = new Map();
  let mcpPromise = null;
  const mcp = () => (mcpPromise ??= connect("badge-meeting"));

  async function badgeFor(employee, fresh = false) {
    const cached = badges.get(employee.id);
    if (fresh || !cached || Date.now() - cached.at > BADGE_TTL_MS) {
      badges.set(employee.id, {
        at: Date.now(),
        badge: openBadge(await mcp(), employee, "Listen to the leadership meeting for my role", "meeting"),
      });
    }
    return badges.get(employee.id).badge;
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
        const hear = async (fresh) => {
          const badge = await badgeFor(employee, fresh);
          const raw = await (await mcp()).call(`Meeting_${topic}_notes`, {
            kwargs: "",
            agntid_task_id: badge.taskId,
            ...(badge.delegationId ? { agntid_delegation_id: badge.delegationId } : {}),
          });
          return { badge, result: parseCall(raw) };
        };
        let { badge, result } = await hear(false);
        // Stale task: reopen the badge and ask AgntID once more.
        if (/expired|closed|unknown|cannot be attributed/i.test(result.reason ?? "")) ({ badge, result } = await hear(true));
        const { taskId, delegationId } = badge;
        emit({
          type: "route",
          route: { utterance: id, agent: employee.id, topic, verdict: result.verdict, reason: result.reason, steps: result.steps },
        });
        if (result.verdict !== "deny") {
          const heardId = `${id}-${employee.id}`;
          emit({ type: "heard", heard: { id: heardId, agent: employee.id, topic, text } });
          // The employee files what it heard into its own Notion notes page, under its own badge.
          if (employee.notesPage) {
            const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
            const write = await (await mcp()).call("notion_API-post-page", {
              ...notionPageArgs({
                title: `${TOPIC_EMOJI[topic]} ${time} · ${text}`.slice(0, 120),
                markdown: `# Heard in the leadership meeting (${topic})
${text}
- Filed by ${employee.name} (${employee.role})
- Delivered by AgntID under badge: ${(employee.toolAllowlist ?? []).join(", ")}`,
                parentId: employee.notesPage,
                emoji: TOPIC_EMOJI[topic],
              }),
              agntid_task_id: taskId,
              ...(delegationId ? { agntid_delegation_id: delegationId } : {}),
            });
            const w = parseCall(write);
            emit({
              type: "filed",
              filed: { heard: heardId, agent: employee.id, verdict: w.verdict, url: typeof w.payload?.url === "string" ? w.payload.url : null },
            });
          }
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
