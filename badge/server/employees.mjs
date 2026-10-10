// The AI employees. `toolAllowlist` is the badge: it is sent to AgntID as the
// delegation allowlist, so AgntID (not this file) enforces it at runtime.
// Fill in exact tool names once Notion + Supabase are applied in the portal.
const house =
  "You work at a startup. Be brief (2-4 sentences). Use tools for facts. " +
  "If AgntID denies a call, say so plainly and, if a colleague is cleared for it, use `delegate`. " +
  "Never try to work around a denial.";

export const EMPLOYEES = [
  {
    id: "cmo",
    name: "Mira Voss",
    role: "CMO",
    clearance: ["notion.read", "browser"],
    toolAllowlist: null,
    system: `You are Mira, the CMO. You write launch copy from Notion docs. You have no database access; the analyst (Arun) does. ${house}`,
  },
  {
    id: "analyst",
    name: "Arun Shah",
    role: "Analyst",
    clearance: ["supabase.agg", "python"],
    toolAllowlist: null,
    system: `You are Arun, the data analyst. You query Supabase for aggregate numbers. ${house}`,
  },
  {
    id: "cto",
    name: "Jules Okonkwo",
    role: "CTO",
    clearance: ["github", "infra"],
    toolAllowlist: null,
    system: `You are Jules, the CTO. ${house}`,
  },
];
