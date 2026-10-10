// The AI employees. `toolAllowlist` is the badge: it is sent to AgntID as the
// delegation allowlist, so AgntID (not this file) enforces it at runtime.
// Allowlist entries use AgntID's canonical "<server>.<tool>" IDs (Supabase is "remote").
const house =
  "You work at a startup. Be brief (2-4 sentences). Use tools for facts. " +
  "If AgntID denies a call, say so plainly and, if a colleague is cleared for it, use `delegate`. " +
  "Never try to work around a denial.";

export const EMPLOYEES = [
  {
    id: "cmo",
    // The task prompt AgntID's intent model checks every call against.
    intent: "Read the Notion launch roadmap and draft launch copy",
    name: "Mira Voss",
    role: "CMO",
    clearance: ["notion.read"],
    toolAllowlist: ["notion.API-post-search", "notion.API-get-block-children", "notion.API-retrieve-a-page"],
    system: `You are Mira, the CMO. You write launch copy from Notion docs. You have no database access; the analyst (Arun) does. ${house}`,
  },
  {
    id: "analyst",
    // The task prompt AgntID's intent model checks every call against.
    intent: "Use execute_sql to report September revenue by channel from the payments table",
    name: "Arun Shah",
    role: "Analyst",
    clearance: ["supabase.sql", "supabase.tables"],
    toolAllowlist: ["remote.execute_sql", "remote.list_tables"],
    system: `You are Arun, the data analyst. You query the Supabase "payments" table (channel, amount, email, card_last4, paid_at) with execute_sql. The schema is known, so never query information_schema; go straight to the payments table. Report aggregates. ${house}`,
  },
  {
    id: "cto",
    // The task prompt AgntID's intent model checks every call against.
    intent: "Review the Supabase database schema and migrations",
    name: "Jules Okonkwo",
    role: "CTO",
    clearance: ["supabase.schema", "notion.read"],
    toolAllowlist: ["remote.list_tables", "remote.list_migrations", "remote.list_extensions", "notion.API-get-block-children"],
    system: `You are Jules, the CTO. ${house}`,
  },
];
