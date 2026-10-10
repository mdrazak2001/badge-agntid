import { Xray } from "./Xray.tsx";
import type { AgentId, ScanEvent } from "./types";
import { AGENTS } from "./script";

type Props = {
  current: ScanEvent | null;
  log: ScanEvent[];
  phase: "idle" | "scanning" | "settled";
  enforced: boolean;
  onToggle: () => void;
  inject: string | null;
  active: AgentId | null;
};

function roleOf(id: AgentId) {
  return AGENTS.find((a) => a.id === id)?.role ?? id;
}

export function ScanBay({
  current,
  log,
  phase,
  enforced,
  onToggle,
  inject,
  active,
}: Props) {
  const shown = !current
    ? null
    : !enforced && current.verdict === "deny"
      ? {
          ...current,
          verdict: "allow" as const,
          rule: "ENFORCEMENT OFF · this bag would have been denied",
        }
      : current;
  const leaked = Boolean(current && current.verdict === "deny" && !enforced);
  const denied = shown?.verdict === "deny";

  return (
    <aside className="bay">
      <header className="bay-head">
        <div>
          <p className="kicker">Scan bay</p>
          <h2>AgntID live</h2>
        </div>
        <button
          type="button"
          className={enforced ? "switch on" : "switch off"}
          onClick={onToggle}
          aria-pressed={enforced}
        >
          <span className="switch-knob" />
          {enforced ? "Enforce" : "Bypass"}
        </button>
      </header>

      <div className={`glass ${denied ? "alarm" : ""} ${leaked ? "leak" : ""} ${phase}`}>
        <div className="glass-meta">
          <span>
            {shown
              ? `${roleOf(shown.agent)} at the belt`
              : active
                ? `${roleOf(active)} at the belt`
                : "Belt idle"}
          </span>
          <span className="mono">{shown ? shown.tool : "awaiting call"}</span>
        </div>

        <div className={`suitcase ${phase} ${shown ? shown.verdict : ""}`}>
          <div className="case-lid" />
          <div className="case-body">
            {shown ? (
              <Xray kind={shown.kind} verdict={shown.verdict} />
            ) : (
              <p className="empty-scan">No bag on the belt</p>
            )}
          </div>
          <div className="sweep" />
        </div>

        <p className="args mono">{shown ? shown.args : "—"}</p>
        {shown && (
          <p className={`rule ${shown.verdict}`}>
            {leaked ? "LEAK · " : ""}
            {shown.verdict === "deny" ? "DENIED  " : "CLEARED  "}
            {shown.rule}
          </p>
        )}
      </div>

      {inject && <p className="inject">{inject}</p>}

      <ol className="tape">
        {log
          .slice()
          .reverse()
          .map((item) => {
            const v = enforced ? item.verdict : "allow";
            return (
              <li key={item.id} className={v}>
                <span className="dot" />
                <span className="mono">
                  {roleOf(item.agent)} · {item.tool}
                </span>
                <span className="verdict">{v === "deny" ? "deny" : "allow"}</span>
              </li>
            );
          })}
      </ol>
    </aside>
  );
}
