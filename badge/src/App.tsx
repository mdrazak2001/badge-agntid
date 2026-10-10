import { useEffect, useRef, useState } from "react";
import { ScanBay } from "./ScanBay.tsx";
import { AGENTS, BEATS } from "./script";
import type { AgentId, ChatMessage, ScanEvent } from "./types";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [log, setLog] = useState<ScanEvent[]>([]);
  const [current, setCurrent] = useState<ScanEvent | null>(null);
  const [phase, setPhase] = useState<"idle" | "scanning" | "settled">("idle");
  const [active, setActive] = useState<AgentId | null>(null);
  const [inject, setInject] = useState<string | null>(null);
  const [enforced, setEnforced] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, current]);

  function clearTimers() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }

  function play() {
    clearTimers();
    setMessages([]);
    setLog([]);
    setCurrent(null);
    setPhase("idle");
    setActive(null);
    setInject(null);
    setPlaying(true);
    setDone(false);

    for (const beat of BEATS) {
      const id = window.setTimeout(() => {
        if (beat.type === "message") {
          setMessages((prev) => [...prev, beat.message]);
        } else if (beat.type === "active") {
          setActive(beat.agent);
        } else if (beat.type === "inject") {
          setInject(beat.note);
        } else {
          setCurrent(beat.scan);
          setPhase("scanning");
          const settle = window.setTimeout(() => {
            setPhase("settled");
            setLog((prev) => [...prev, beat.scan]);
          }, 900);
          timers.current.push(settle);
        }
      }, beat.at);
      timers.current.push(id);
    }

    const end = window.setTimeout(() => {
      setPlaying(false);
      setDone(true);
    }, 16000);
    timers.current.push(end);
  }

  useEffect(() => () => clearTimers(), []);

  return (
    <div className="shell">
      <header className="mast">
        <div className="brand">
          <span className="mark" />
          <strong>BADGE</strong>
          <span className="sep">/</span>
          <span>the firm</span>
        </div>
        <button type="button" className="run" onClick={play} disabled={playing}>
          {playing ? "Briefing live" : done ? "Replay briefing" : "Run launch briefing"}
        </button>
        <p className="mast-note">
          Three employees. One AgntID runtime. Access is a badge, not a session.
        </p>
      </header>

      <div className="stage">
        <nav className="roster" aria-label="Employees">
          <p className="kicker">Issued badges</p>
          {AGENTS.map((agent) => (
            <article
              key={agent.id}
              className={`employee ${agent.id} ${active === agent.id ? "live" : ""}`}
            >
              <div className={`avatar ${agent.id}`} aria-hidden="true">
                {agent.role.slice(0, 1)}
              </div>
              <div>
                <h3>{agent.name}</h3>
                <p className="role">{agent.role}</p>
                <ul>
                  {agent.clearance.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
          <p className="foot">
            CMO cannot borrow the analyst badge. Same tool, different contents, different scan.
          </p>
        </nav>

        <section className="thread" aria-label="Launch brief">
          <header>
            <p className="kicker">Channel</p>
            <h2>#launch-brief</h2>
          </header>
          <div className="messages" ref={threadRef}>
            {messages.length === 0 && (
              <p className="idle-copy">
                Press run. Mira will try the warehouse. Arun will be allowed the sums and denied the
                cards. Then a page will try to leave the building with the users table.
              </p>
            )}
            {messages.map((m) => (
              <article key={m.id} className={`msg ${m.from}`}>
                <p className="who">
                  {m.from === "you"
                    ? "You"
                    : AGENTS.find((a) => a.id === m.from)?.name}
                </p>
                <p>{m.text}</p>
              </article>
            ))}
          </div>
        </section>

        <ScanBay
          current={current}
          log={log}
          phase={phase}
          enforced={enforced}
          onToggle={() => setEnforced((v) => !v)}
          inject={inject}
          active={active}
        />
      </div>
    </div>
  );
}
