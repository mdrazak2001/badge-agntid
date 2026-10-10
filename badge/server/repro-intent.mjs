// Minimal repro for AgntID team: intent_parsing denies on-task calls.
import { connect } from "./mcp.mjs";
const c = await connect("repro");
const out = [];
const log = (s) => { console.log(s); out.push(s); };
const task = "repro-" + Date.now();
const prompt = "Read the Notion launch roadmap and draft launch copy";
const open = { task_id: task, agent_id: "cmo", user_id: "founder", prompt };
log("### 1. tools/call agntid_task_open\n" + JSON.stringify(open, null, 2));
const o = await c.call("agntid_task_open", open);
log("→ ok: " + o.result.structuredContent?.result?.ok + " | relevant_tool_names: " + JSON.stringify(o.result.structuredContent?.result?.intent?.snapshot?.relevant_tool_names));
const calls = [
  ["notion_API-post-search", { query: "Q3 roadmap", page_size: 10 }],
  ["remote_execute_sql", { query: "SELECT channel, sum(amount) FROM payments GROUP BY 1" }],
];
let n = 2;
for (const [name, args] of calls) {
  log(`\n### ${n++}. tools/call ${name}\n` + JSON.stringify({ ...args, agntid_task_id: task }, null, 2));
  const r = await c.call(name, { ...args, agntid_task_id: task });
  const t = r.result.content[0].text;
  const b = JSON.parse(t.slice(t.indexOf("{")));
  const s = b.__agntid_execution_flow.steps.find((x) => x.step === "intent_parsing").details;
  log(`→ isError: ${r.result.isError}\n→ intent_parsing: ` + JSON.stringify({ status: s.status, verdict: s.verdict, verdict_code: s.verdict_code, verdict_reason: s.verdict_reason, confidence: s.confidence, prompt: s.prompt }, null, 2));
  log("→ steps: " + b.__agntid_execution_flow.steps.map((x) => `${x.step}:${x.status}`).join(" > "));
}
await c.call("agntid_task_close", { task_id: task });
const st = await (await fetch("http://localhost:8080/api/status")).json();
log(`\nRuntime ${st.runtime_id} · v2.0.0 · intent parser cross-encoder/nli-deberta-v3-base · profile Low (Override) on notion + remote`);
(await import("fs")).writeFileSync("../intent-repro-latest.md", "# AgntID intent_parsing repro\n\n```\n" + out.join("\n") + "\n```\n");
