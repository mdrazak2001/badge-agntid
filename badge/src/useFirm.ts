import { useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_BADGE_WS ?? "ws://localhost:8787";

export type Employee = {
  id: string;
  name: string;
  role: string;
  clearance: string[];
  toolAllowlist: string[] | null;
};

export type Step = { step: string; status: string; reason: string | null; confidence: number | null };

export type Item =
  | { kind: "msg"; id: string; from: string; text: string; ts: number }
  | {
      kind: "call";
      id: string;
      agent: string;
      tool: string;
      args: Record<string, unknown>;
      verdict: "pending" | "allow" | "deny" | "review";
      reason: string | null;
      steps: Step[];
      ms: number | null;
      url: string | null;
      ts: number;
    }
  | { kind: "handoff"; id: string; from: string; to: string; request: string; ts: number }
  | { kind: "heard"; id: string; agent: string; topic: string; text: string; ts: number };

export function useFirm() {
  const [connected, setConnected] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [utterances, setUtterances] = useState<{ id: string; text: string; topic: string }[]>([]);
  const [routes, setRoutes] = useState<{ utterance: string; agent: string; topic: string; verdict: string; reason: string | null }[]>([]);
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
        const ts = ev.ts ?? Date.now();
        switch (ev.type) {
          case "hello":
            setEmployees(ev.employees);
            break;
          case "message":
            setItems((p) => [...p, { kind: "msg", id: ev.message.id, from: ev.message.from, text: ev.message.text, ts }]);
            break;
          case "active":
            setActive(ev.agent);
            break;
          case "delegation":
            setItems((p) => [...p, { kind: "handoff", id: `h-${ts}`, from: ev.from, to: ev.to, request: ev.request, ts }]);
            break;
          case "scan_start":
            setItems((p) => [
              ...p,
              {
                kind: "call",
                id: ev.scan.id,
                agent: ev.scan.agent,
                tool: ev.scan.tool,
                args: ev.scan.args,
                verdict: "pending",
                reason: null,
                steps: [],
                ms: null,
                url: null,
                ts,
              },
            ]);
            break;
          case "scan_result":
            setItems((p) =>
              p.map((it) =>
                it.kind === "call" && it.id === ev.scan.id
                  ? { ...it, verdict: ev.scan.verdict, reason: ev.scan.reason, steps: ev.scan.steps ?? [], ms: ev.scan.durationMs, url: typeof ev.scan.payload?.url === "string" ? ev.scan.payload.url : null }
                  : it,
              ),
            );
            break;
          case "utterance":
            setUtterances((p) => [...p, ev.utterance]);
            break;
          case "route":
            setRoutes((p) => [...p, ev.route]);
            break;
          case "heard":
            setItems((p) => [...p, { kind: "heard", ...ev.heard, ts }]);
            break;
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

  function send(text: string, enforce: boolean) {
    if (!ws.current || ws.current.readyState !== 1 || !text.trim()) return;
    setError(null);
    setBusy(true);
    ws.current.send(JSON.stringify({ type: "prompt", text, enforce }));
  }

  return { connected, employees, items, active, busy, error, utterances, routes, send, clear: () => setItems([]) };
}
