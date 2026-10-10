import { useEffect, useRef, useState } from "react";
import type { Employee } from "./useFirm";

const AUDIO_URL = import.meta.env.VITE_BADGE_AUDIO_WS ?? "ws://localhost:8788";

export type Utterance = { id: string; text: string; topic: string };
export type Route = { utterance: string; agent: string; topic: string; verdict: string; reason: string | null };

const TOPIC_HUE: Record<string, string> = {
  finance: "#4f8bff",
  marketing: "#ff5fa2",
  engineering: "#ff8a3d",
  people: "#b06bff",
};

export function MeetingMic({
  employees,
  utterances,
  routes,
  hue,
}: {
  employees: Employee[];
  utterances: Utterance[];
  routes: Route[];
  hue: Record<string, string>;
}) {
  const [open, setOpen] = useState(true);
  const [live, setLive] = useState(false);
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const sock = useRef<WebSocket | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [utterances, routes, interim]);

  function ensureSocket(): Promise<WebSocket> {
    if (sock.current && sock.current.readyState === 1) return Promise.resolve(sock.current);
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(AUDIO_URL);
      ws.binaryType = "arraybuffer";
      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error("meeting server offline"));
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === "interim") setInterim(m.text);
        if (m.type === "final") setInterim("");
        if (m.type === "error") setErr(m.message);
      };
      ws.onclose = () => {
        sock.current = null;
        setLive(false);
      };
      sock.current = ws;
    });
  }

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ws = await ensureSocket();
      const r = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      r.ondataavailable = (e) => e.data.size && ws.readyState === 1 && e.data.arrayBuffer().then((b) => ws.send(b));
      r.start(250);
      rec.current = r;
      setLive(true);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    }
  }

  function stop() {
    rec.current?.stop();
    rec.current?.stream.getTracks().forEach((t) => t.stop());
    rec.current = null;
    sock.current?.close();
    setLive(false);
    setInterim("");
  }

  async function say(e: React.FormEvent) {
    e.preventDefault();
    if (!typed.trim()) return;
    try {
      const ws = await ensureSocket();
      ws.send(JSON.stringify({ type: "say", text: typed }));
      setTyped("");
    } catch (x) {
      setErr(String((x as Error).message));
    }
  }

  if (!open) {
    return (
      <button className="mic-fab" onClick={() => setOpen(true)}>
        🎙 Live meeting
      </button>
    );
  }

  return (
    <div className={`meeting ${live ? "rec" : ""}`}>
      <div className="meeting-head">
        <span className="rec-dot" />
        <b>Live meeting</b>
        <span className="meeting-sub">AgntID routes each sentence by badge</span>
        <button className="x" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>

      <div className="meeting-list" ref={list}>
        {utterances.length === 0 && !interim && (
          <p className="meeting-empty">Press the mic and talk about revenue, the launch, infra or hiring.</p>
        )}
        {utterances.map((u) => (
          <div key={u.id} className="utt">
            <span className="topic" style={{ background: `${TOPIC_HUE[u.topic]}33`, color: TOPIC_HUE[u.topic] }}>
              {u.topic}
            </span>
            <p>{u.text}</p>
            <div className="routes">
              {employees.map((e) => {
                const r = routes.find((x) => x.utterance === u.id && x.agent === e.id);
                const v = !r ? "wait" : r.verdict === "deny" ? "deny" : "allow";
                return (
                  <span key={e.id} className={`route ${v}`} title={r?.reason ?? ""} style={{ ["--c" as string]: hue[e.id] }}>
                    <i />
                    {e.name.split(" ")[0]}
                    <b>{v === "wait" ? "…" : v === "deny" ? "✕" : "✓"}</b>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {interim && <p className="interim">{interim}</p>}
      </div>

      {err && <p className="meeting-err">{err}</p>}
      <div className="meeting-ctl">
        <button className={`mic ${live ? "on" : ""}`} onClick={live ? stop : start}>
          {live ? "■" : "🎙"}
        </button>
        <form onSubmit={say}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="…or type a line from the meeting" />
        </form>
      </div>
    </div>
  );
}
