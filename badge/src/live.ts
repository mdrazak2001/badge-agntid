import { useEffect, useRef, useState } from "react";
import type { AgentId, ChatMessage, ContentsKind, LiveScan } from "./types";

const WS_URL = import.meta.env.VITE_BADGE_WS ?? "ws://localhost:8787";

// Guess what the x-ray should draw from the tool name + arguments.
function kindOf(tool: string, args: string): ContentsKind {
  const s = `${tool} ${args}`.toLowerCase();
  if (/\.env|secret|token|api[_-]?key|password/.test(s)) return "secret";
  if (/email|phone|card|pan|aadhaar|ssn|address/.test(s)) return "pii";
  if (/http|post|webhook|fetch|send|slack/.test(s)) return "transmitter";
  if (/browser|navigate|url/.test(s)) return "browser";
  if (/sum\(|count\(|avg\(|group by/.test(s)) return "aggregates";
  return "papers";
}

type RawScan = {
  id: string;
  agent: AgentId;
  tool: string;
  args: Record<string, unknown>;
  verdict?: "allow" | "deny" | "review";
  reason?: string | null;
  steps?: LiveScan["steps"];
  durationMs?: number | null;
  eventId?: string | null;
};

// Runtime tool names are `<serverId>_<tool>`; Supabase was registered as `remote`.
const SERVER_LABELS: Record<string, string> = { remote: "supabase", notion: "notion", github: "github" };
function displayTool(name: string): string {
  const [server, ...rest] = name.split("_");
  return server in SERVER_LABELS ? `${SERVER_LABELS[server]}.${rest.join("_")}` : name;
}

function toScan(raw: RawScan): LiveScan {
  const args = Object.entries(raw.args ?? {})
    .map(([k, v]) => `${k} = ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("  ");
  const policy = raw.steps?.find((s) => s.step === "policy_evaluation")?.policy;
  return {
    id: raw.id,
    agent: raw.agent,
    tool: displayTool(raw.tool),
    args,
    kind: kindOf(raw.tool, args),
    verdict: raw.verdict === "deny" ? "deny" : "allow",
    verdictRaw: raw.verdict,
    rule: raw.reason ?? policy ?? (raw.verdict === "review" ? "Intent unconfirmed · flagged for review" : "Cleared"),
    steps: raw.steps,
    durationMs: raw.durationMs,
    eventId: raw.eventId,
  };
}

export function useLive() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [log, setLog] = useState<LiveScan[]>([]);
  const [current, setCurrent] = useState<LiveScan | null>(null);
  const [phase, setPhase] = useState<"idle" | "scanning" | "settled">("idle");
  const [active, setActive] = useState<AgentId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: number | undefined;
    const open = () => {
      const sock = new WebSocket(WS_URL);
      ws.current = sock;
      sock.onopen = () => setConnected(true);
      sock.onclose = () => {
        setConnected(false);
        if (!closed) retry = window.setTimeout(open, 1500);
      };
      sock.onmessage = (e) => {
        const ev = JSON.parse(e.data);
        switch (ev.type) {
          case "message":
            setMessages((p) => [...p, ev.message]);
            break;
          case "active":
            setActive(ev.agent);
            break;
          case "scan_start":
            setCurrent(toScan(ev.scan));
            setPhase("scanning");
            break;
          case "scan_result": {
            const s = toScan(ev.scan);
            setCurrent(s);
            setPhase("settled");
            setLog((p) => [...p, s]);
            break;
          }
          case "done":
            setBusy(false);
            break;
          case "error":
            setError(ev.message);
            setBusy(false);
            break;
        }
      };
    };
    open();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      ws.current?.close();
    };
  }, []);

  function send(text: string) {
    if (!ws.current || ws.current.readyState !== 1 || !text.trim()) return;
    setError(null);
    setBusy(true);
    ws.current.send(JSON.stringify({ type: "prompt", text }));
  }

  function reset() {
    setMessages([]);
    setLog([]);
    setCurrent(null);
    setPhase("idle");
  }

  return { connected, messages, log, current, phase, active, busy, error, send, reset };
}
