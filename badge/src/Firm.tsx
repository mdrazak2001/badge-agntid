import { useEffect, useMemo, useRef, useState } from "react";
import { useFirm, type Employee, type Item } from "./useFirm";
import { MeetingMic } from "./MeetingMic";
import "./firm.css";

const HUE: Record<string, string> = { cmo: "#ff5fa2", analyst: "#4f8bff", cto: "#ff8a3d", you: "#e8e8ea" };
const STEP_LABEL: Record<string, string> = {
  guardrail_validation: "Guard",
  intent_parsing: "Intent",
  policy_evaluation: "Policy",
  credential_resolution: "Creds",
  tool_execution: "Exec",
};

function Blob({ id, size = 44, live = false }: { id: string; size?: number; live?: boolean }) {
  const c = HUE[id] ?? "#888";
  return (
    <svg className={`blob ${live ? "live" : ""}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M32 4c13 0 26 9 27 24 1 16-10 31-27 32C15 61 4 49 5 33 6 16 19 4 32 4z"
        fill={c}
      />
      <ellipse className="eye" cx="25" cy="27" rx="4" ry="6.5" fill="#0b0b0d" />
      <ellipse className="eye" cx="40" cy="25" rx="4" ry="6.5" fill="#0b0b0d" />
      <circle cx="26.5" cy="24.5" r="1.4" fill="#fff" />
      <circle cx="41.5" cy="22.5" r="1.4" fill="#fff" />
    </svg>
  );
}

function rich(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith("`") ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      part
    ),
  );
}

const cleanReason = (r: string | null) =>
  (r ?? "").replace(/^Error executing tool [^:]+:\s*/, "").replace(/; request denied\.?$/, "");

const prettyTool = (t: string) => t.replace(/^remote_/, "supabase.").replace(/^notion_/, "notion.");

function CallCard({ it, who }: { it: Extract<Item, { kind: "call" }>; who?: Employee }) {
  const sql = typeof it.args.query === "string" ? it.args.query : null;
  const page = typeof it.args.title === "string" ? `📄 ${it.args.title}
${String(it.args.markdown ?? "").slice(0, 280)}` : null;
  const argText = sql ?? page ?? JSON.stringify(it.args);
  const v = it.verdict;
  return (
    <div className={`call ${v}`}>
      <div className="call-head">
        <span className="shield">◆</span>
        <span className="call-who">{who?.name.split(" ")[0]}</span>
        <span className="call-tool">{prettyTool(it.tool)}</span>
        <span className={`verdict ${v}`}>
          {v === "pending" ? "AgntID scanning…" : v === "deny" ? "BLOCKED" : v === "error" ? "TOOL ERROR" : v === "review" ? "REVIEW" : "ALLOWED"}
        </span>
      </div>
      <pre className="call-args">{argText}</pre>
      {it.steps.length > 0 && (
        <div className="lamps">
          {it.steps.map((s) => (
            <span key={s.step} className={`lamp ${/fail|denied/.test(s.status) ? "bad" : s.status === "skipped" ? "off" : "ok"}`}>
              {STEP_LABEL[s.step] ?? s.step}
            </span>
          ))}
          {it.ms != null && <span className="ms">{Math.round(it.ms)}ms</span>}
        </div>
      )}
      {v === "deny" && <p className="call-reason">{cleanReason(it.reason)}</p>}
      {it.url && (
        <a className="call-link" href={it.url} target="_blank" rel="noreferrer">
          Published to Notion ↗
        </a>
      )}
    </div>
  );
}

export default function Firm() {
  const firm = useFirm();
  const [channel, setChannel] = useState<string>("all");
  const [draft, setDraft] = useState("");
  const [enforce, setEnforce] = useState(true);
  const feed = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => Object.fromEntries(firm.employees.map((e) => [e.id, e])), [firm.employees]);

  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [firm.items, firm.active]);

  const visible = firm.items.filter((it) => {
    if (channel === "all") return true;
    if (it.kind === "msg") return it.from === channel || it.from === "you";
    if (it.kind === "call" || it.kind === "heard") return it.agent === channel;
    return it.from === channel || it.to === channel;
  });

  const calls = firm.items.filter((i): i is Extract<Item, { kind: "call" }> => i.kind === "call");
  const blocked = calls.filter((c) => c.verdict === "deny").length;
  const allowed = calls.filter((c) => c.verdict === "allow" || c.verdict === "review").length;
  const lastAt = (id: string) => [...firm.items].reverse().find((i) => i.kind === "msg" && i.from === id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const text = channel !== "all" && !draft.includes("@") ? `@${byId[channel]?.name.split(" ")[0].toLowerCase()} ${draft}` : draft;
    firm.send(text, enforce);
    setDraft("");
  }

  const current = channel === "all" ? null : byId[channel];
  // Most recent blocked call drives the red flash + the offending agent's badge pulse.
  const lastDeny = [...calls].reverse().find((c) => c.verdict === "deny");
  const flashKey = lastDeny ? lastDeny.id : "none";

  return (
    <div className={`firm ${enforce ? "" : "bypass"}`}>
      {lastDeny && <div key={flashKey} className="deny-flash" />}
      <aside className="side">
        <div className="side-brand">
          <span className="logo">◆</span> BADGE
          <span className={`conn ${firm.connected ? "on" : ""}`}>{firm.connected ? "AgntID live" : "offline"}</span>
        </div>

        <div className="stack">
          {firm.employees.map((e) => (
            <button key={e.id} className={`stack-item ${channel === e.id ? "sel" : ""}`} onClick={() => setChannel(e.id)}>
              <Blob id={e.id} size={56} live={firm.active === e.id} />
              <span>{e.role}</span>
            </button>
          ))}
        </div>

        <nav className="chats">
          <button className={`chat ${channel === "all" ? "sel" : ""}`} onClick={() => setChannel("all")}>
            <div className="group-ava">
              {firm.employees.map((e) => (
                <Blob key={e.id} id={e.id} size={26} />
              ))}
            </div>
            <div>
              <b>The Firm</b>
              <p>Everyone · every call scanned by AgntID</p>
            </div>
          </button>
          {firm.employees.map((e) => {
            const last = lastAt(e.id);
            return (
              <button key={e.id} className={`chat ${channel === e.id ? "sel" : ""}`} onClick={() => setChannel(e.id)}>
                <Blob id={e.id} size={40} live={firm.active === e.id} />
                <div>
                  <b>{e.name}</b>
                  <p>{firm.active === e.id ? "typing…" : last && last.kind === "msg" ? last.text : e.role}</p>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="room">
        {!enforce && <div className="bypass-banner">AgntID bypassed · agents have every tool</div>}
        <header className="room-head">
          {current ? <Blob id={current.id} size={34} /> : <span className="hash">#</span>}
          <div>
            <h1>{current ? current.name : "The Firm"}</h1>
            <p>{current ? `${current.role} · badge: ${(current.toolAllowlist ?? []).join(", ")}` : "Group chat · CMO, Analyst, CTO"}</p>
          </div>
        </header>

        <div className="feed" ref={feed}>
          {visible.length === 0 && (
            <div className="empty">
              <div className="empty-blobs">
                {firm.employees.map((e) => (
                  <Blob key={e.id} id={e.id} size={72} />
                ))}
              </div>
              <h2>Every AI employee gets a badge.</h2>
              <p>AgntID checks every tool call against it, at runtime.</p>
              <button
                className="suggest"
                onClick={() =>
                  setDraft("@mira Draft the Q3 launch post with September revenue by channel and publish it to the Launch Desk in Notion.")
                }
              >
                Try: “@mira Draft the Q3 launch post with September revenue by channel and publish it to the Launch Desk in Notion.”
              </button>
            </div>
          )}
          {visible.map((it) => {
            if (it.kind === "msg") {
              const mine = it.from === "you";
              const e = byId[it.from];
              return (
                <div key={it.id} className={`row ${mine ? "mine" : ""}`}>
                  {!mine && <Blob id={it.from} size={32} />}
                  <div className="bubble" style={mine ? undefined : { borderColor: `${HUE[it.from]}40` }}>
                    {!mine && <span className="name" style={{ color: HUE[it.from] }}>{e?.name ?? it.from}</span>}
                    <p>{rich(it.text)}</p>
                  </div>
                </div>
              );
            }
            if (it.kind === "heard") {
              return (
                <div key={it.id} className="heard">
                  <Blob id={it.agent} size={18} />
                  <span>{byId[it.agent]?.name.split(" ")[0]} heard</span>
                  <em className={`t-${it.topic}`}>{it.topic}</em>
                  <q>{it.text}</q>
                  {it.filed !== undefined &&
                    (it.filed ? (
                      <a className="filed" href={it.filed} target="_blank" rel="noreferrer">
                        📝 filed in Notion ↗
                      </a>
                    ) : (
                      <span className="filed fail">notion write failed</span>
                    ))}
                </div>
              );
            }
            if (it.kind === "handoff") {
              return (
                <div key={it.id} className="handoff">
                  <Blob id={it.from} size={20} /> <span>{byId[it.from]?.name.split(" ")[0]}</span>
                  <span className="arrow">→</span>
                  <Blob id={it.to} size={20} /> <span>{byId[it.to]?.name.split(" ")[0]}</span>
                  <em>handoff · new AgntID badge issued</em>
                </div>
              );
            }
            return (
              <div key={it.id} className="row">
                <span className="spacer" />
                <CallCard it={it} who={byId[it.agent]} />
              </div>
            );
          })}
          {firm.active && (
            <div className="row">
              <Blob id={firm.active} size={32} live />
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>

        <form className="composer" onSubmit={submit}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={current ? `Message ${current.name}` : "Message the firm · @mira @arun @jules"}
            disabled={!firm.connected || firm.busy}
          />
          <button disabled={!firm.connected || firm.busy || !draft.trim()}>↑</button>
        </form>
        {firm.error && <p className="err">{firm.error}</p>}
      </main>

      <MeetingMic employees={firm.employees} utterances={firm.utterances} routes={firm.routes} hue={HUE} />
      <aside className="guard">
        <div className="guard-head">
          <span className="logo big">◆</span>
          <div>
            <h2>AgntID</h2>
            <p>Runtime enforcement</p>
          </div>
        </div>

        <button className={`toggle ${enforce ? "on" : "off"}`} onClick={() => setEnforce((v) => !v)}>
          <span className="knob" />
          <b>{enforce ? "ENFORCING BADGES" : "BYPASS · NO BADGES"}</b>
        </button>

        <div className="stats">
          <div>
            <b>{calls.length}</b>
            <span>tool calls</span>
          </div>
          <div className="ok">
            <b>{allowed}</b>
            <span>allowed</span>
          </div>
          <div className="bad">
            <b>{blocked}</b>
            <span>blocked</span>
          </div>
        </div>

        <h3>Badges</h3>
        <div className="badges">
          {firm.employees.map((e) => (
            <div className={`badge-card ${firm.active === e.id ? "live" : ""} ${lastDeny?.agent === e.id ? "denied" : ""}`}
              key={`${e.id}-${lastDeny?.agent === e.id ? flashKey : ""}`} style={{ ["--c" as string]: HUE[e.id] }}>
              <div className="lanyard" />
              <Blob id={e.id} size={38} />
              <div>
                <b>{e.name}</b>
                <span>{e.role}</span>
                <div className="chips">
                  {enforce ? (e.toolAllowlist ?? []).map((t) => <i key={t}>{t.replace(/^remote\./, "supabase.")}</i>) : <i className="all">ALL TOOLS</i>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <h3>Live decisions</h3>
        <div className="ticker">
          {[...calls].reverse().slice(0, 8).map((c) => (
            <div key={c.id} className={`tick ${c.verdict}`}>
              <i />
              <span>{byId[c.agent]?.name.split(" ")[0]}</span>
              <code>{prettyTool(c.tool)}</code>
              <b>{c.verdict === "pending" ? "…" : c.verdict === "deny" ? "BLOCK" : "ALLOW"}</b>
            </div>
          ))}
          {calls.length === 0 && <p className="muted">Waiting for the first tool call.</p>}
        </div>
      </aside>
    </div>
  );
}
