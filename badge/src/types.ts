export type AgentId = "cmo" | "analyst" | "cto";

export type ContentsKind =
  | "papers"
  | "aggregates"
  | "pii"
  | "secret"
  | "transmitter"
  | "browser";

export type ScanVerdict = "allow" | "deny";

export type Agent = {
  id: AgentId;
  name: string;
  role: string;
  clearance: string[];
  forbidden: string[];
};

export type ScanEvent = {
  id: string;
  agent: AgentId;
  tool: string;
  args: string;
  kind: ContentsKind;
  verdict: ScanVerdict;
  rule: string;
};

export type ChatMessage = {
  id: string;
  from: "you" | AgentId;
  text: string;
};

export type Beat =
  | { at: number; type: "message"; message: ChatMessage }
  | { at: number; type: "scan"; scan: ScanEvent }
  | { at: number; type: "active"; agent: AgentId | null }
  | { at: number; type: "inject"; note: string };

export type PipelineStep = {
  step: string;
  status: string;
  reason: string | null;
  confidence: number | null;
  policy: string | null;
};

// Live events from server/index.mjs. A live scan carries AgntID's real pipeline.
export type LiveScan = ScanEvent & {
  steps?: PipelineStep[];
  durationMs?: number | null;
  eventId?: string | null;
  verdictRaw?: "allow" | "deny" | "review";
};
