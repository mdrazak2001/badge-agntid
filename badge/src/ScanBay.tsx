import { Xray } from "./Xray.tsx";
import type { AgentId, LiveScan, PipelineStep, ScanEvent, ScanVerdict } from "./types";
import { AGENTS } from "./script";

const CHECKPOINTS = [
  { id: "guardrail_validation", label: "Guard" },
  { id: "intent_parsing", label: "Intent" },
  { id: "policy_evaluation", label: "Policy" },
  { id: "credential_resolution", label: "Creds" },
  { id: "tool_execution", label: "Exec" },
] as const;

function stepsOf(scan: ScanEvent | null): PipelineStep[] | undefined {
  if (!scan || !("steps" in scan)) return undefined;
  return (scan as LiveScan).steps;
}

type Phase = "idle" | "scanning" | "settled";

function lampOf(
  step: PipelineStep | undefined,
  phase: Phase,
  verdict: ScanVerdict | undefined,
  index: number,
  hasSteps: boolean,
) {
  if (step) {
    if (/fail|denied|block|reject/i.test(step.status)) return "fail";
    if (/hitl|review/i.test(step.status)) return "review";
    return "pass";
  }
  if (phase === "idle") return "off";
  if (hasSteps && phase === "settled") return "off";
  if (verdict === "deny" && index === 2 && phase === "settled") return "fail";
  return "pass";
}

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
  const pipeline = stepsOf(shown);

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
              <>
                <Xray kind={shown.kind} verdict={shown.verdict} />
                <ol className={`checks ${phase}`} key={shown.id}>
                  {CHECKPOINTS.map((cp, i) => {
                    const step = pipeline?.find((s) => s.step === cp.id);
                    const lamp = lampOf(step, phase, shown.verdict, i, Boolean(pipeline?.length));
                    const conf =
                      cp.id === "intent_parsing" && step?.confidence != null
                        ? step.confidence > 1
                          ? Math.round(step.confidence)
                          : Math.round(step.confidence * 100)
                        : null;
                    return (
                      <li
                        key={cp.id}
                        className={`chk ${lamp}`}
                        style={{ animationDelay: `${i * 140}ms` }}
                        title={step?.reason ?? cp.id}
                      >
                        <span className="lamp" />
                        <span className="chk-label">{cp.label}</span>
                        {conf != null && <span className="conf">{conf}</span>}
                      </li>
                    );
                  })}
                </ol>
              </>
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
