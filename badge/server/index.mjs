// BADGE live server: runs the AI employees, routes every tool call through the
// AgntID runtime, and streams what AgntID decided to the UI over a websocket.
import "dotenv/config";
import OpenAI from "openai";
import { WebSocketServer } from "ws";
import { connect } from "./mcp.mjs";
import { EMPLOYEES } from "./employees.mjs";

const PORT = Number(process.env.BADGE_WS_PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const openai = new OpenAI();
const GLUE = /^agntid_/;

const wss = new WebSocketServer({ port: PORT });
const emit = (event) => {
  const data = JSON.stringify({ ...event, ts: Date.now() });
  for (const c of wss.clients) if (c.readyState === 1) c.send(data);
};

// ---- AgntID response parsing -------------------------------------------------

function parseCall(msg) {
  if (msg.error) return { verdict: "deny", reason: msg.error.message, steps: [], payload: null };
  const text = msg.result?.content?.map((c) => c.text ?? "").join("\n") ?? "";
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const flow = body?.__agntid_execution_flow;
  const steps = (flow?.steps ?? []).map((s) => ({
    step: s.step,
    status: s.status,
    reason:
      s.details?.verdict_reason ?? s.details?.reason ?? s.details?.error ?? null,
    confidence: s.details?.confidence ?? null,
    policy: s.details?.policy_name ?? null,
    failedRules: s.details?.failed_rules ?? [],
  }));
  const blocked = steps.find((s) => /fail|denied|block|reject/i.test(s.status));
  const isError = Boolean(msg.result?.isError);
  const verdict = blocked || isError ? "deny" : steps.some((s) => s.status === "hitl") ? "review" : "allow";
  return {
    verdict,
    reason: blocked?.reason ?? (isError ? text.slice(0, 400) : null),
    steps,
    eventId: flow?.event_id ?? null,
    durationMs: flow?.total_duration_ms ?? null,
    payload: body?.__agntid_result ?? (body ? null : text),
  };
}

// ---- Agent loop ----------------------------------------------------------------

function toOpenAITool(t) {
  const props = Object.fromEntries(
    Object.entries(t.inputSchema?.properties ?? {}).filter(([k]) => !k.startsWith("agntid_")),
  );
  return {
    type: "function",
    function: {
      name: t.name,
      description: (t.description ?? "").slice(0, 1000),
      parameters: { ...t.inputSchema, properties: props, required: (t.inputSchema?.required ?? []).filter((k) => k in props) },
    },
  };
}

const delegateTool = {
  type: "function",
  function: {
    name: "delegate",
    description:
      "Hand a sub-task to a colleague whose badge covers it. Use when AgntID denies you a tool another employee is cleared for.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", enum: EMPLOYEES.map((e) => e.id) },
        request: { type: "string" },
      },
      required: ["to", "request"],
    },
  },
};

async function runAgent({ mcp, tools, taskId, employee, request, parent, depth = 0 }) {
  emit({ type: "active", agent: employee.id });

  let delegationId = null;
  if (parent) {
    delegationId = `${taskId}-${employee.id}-${Date.now()}`;
    const r = await mcp.call("agntid_delegation_open", {
      task_id: taskId,
      delegation_id: delegationId,
      parent_agent_id: parent,
      acting_agent_id: employee.id,
      delegated_intent: { summary: request },
      tool_allowlist: employee.toolAllowlist ?? null,
    });
    emit({ type: "delegation", from: parent, to: employee.id, request, ok: !r.error && !r.result?.isError });
  }

  const messages = [
    { role: "system", content: employee.system },
    { role: "user", content: request },
  ];
  const fnTools = [...tools.map(toOpenAITool), ...(depth < 2 ? [delegateTool] : [])];

  for (let turn = 0; turn < 8; turn++) {
    const res = await openai.chat.completions.create({ model: MODEL, messages, tools: fnTools });
    const m = res.choices[0].message;
    messages.push(m);
    if (m.content && !m.tool_calls?.length) {
      emit({ type: "message", message: { id: `m-${Date.now()}`, from: employee.id, text: m.content } });
      break;
    }
    if (m.content) emit({ type: "message", message: { id: `m-${Date.now()}`, from: employee.id, text: m.content } });

    for (const tc of m.tool_calls ?? []) {
      const args = JSON.parse(tc.function.arguments || "{}");
      let output;
      if (tc.function.name === "delegate") {
        const colleague = EMPLOYEES.find((e) => e.id === args.to);
        output = await runAgent({ mcp, tools, taskId, employee: colleague, request: args.request, parent: employee.id, depth: depth + 1 });
        emit({ type: "active", agent: employee.id });
      } else {
        const scanId = `s-${tc.id}`;
        emit({ type: "scan_start", scan: { id: scanId, agent: employee.id, tool: tc.function.name, args } });
        const raw = await mcp.call(tc.function.name, {
          ...args,
          agntid_task_id: taskId,
          ...(delegationId ? { agntid_delegation_id: delegationId } : {}),
        });
        const result = parseCall(raw);
        emit({ type: "scan_result", scan: { id: scanId, agent: employee.id, tool: tc.function.name, args, ...result } });
        output =
          result.verdict === "deny"
            ? `AgntID DENIED this call: ${result.reason ?? "policy"}`
            : JSON.stringify(result.payload).slice(0, 6000);
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: String(output) });
    }
  }

  if (delegationId) {
    await mcp.call("agntid_delegation_close", { task_id: taskId, delegation_id: delegationId, status: "completed", reason: null });
  }
  const last = [...messages].reverse().find((x) => x.role === "assistant" && x.content);
  return last?.content ?? "(no answer)";
}

async function handlePrompt(text) {
  const mention = text.match(/@(\w+)/)?.[1]?.toLowerCase();
  const employee = EMPLOYEES.find((e) => e.id === mention || e.name.split(" ")[0].toLowerCase() === mention) ?? EMPLOYEES[0];
  const mcp = await connect(`badge-${employee.id}`);
  const tools = (await mcp.listTools()).filter((t) => !GLUE.test(t.name));
  const taskId = `badge-${Date.now()}`;

  await mcp.call("agntid_task_open", { task_id: taskId, agent_id: employee.id, user_id: "founder", prompt: text });
  emit({ type: "task", taskId, agent: employee.id, tools: tools.map((t) => t.name) });
  try {
    await runAgent({ mcp, tools, taskId, employee, request: text });
  } catch (err) {
    emit({ type: "error", message: String(err?.message ?? err) });
  } finally {
    await mcp.call("agntid_task_close", { task_id: taskId }).catch(() => {});
    emit({ type: "active", agent: null });
    emit({ type: "done", taskId });
  }
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello", employees: EMPLOYEES.map(({ system, ...e }) => e), model: MODEL }));
  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.type === "prompt") {
      emit({ type: "message", message: { id: `u-${Date.now()}`, from: "you", text: msg.text } });
      handlePrompt(msg.text);
    }
  });
});

console.log(`BADGE live server on ws://localhost:${PORT} · model ${MODEL}`);
