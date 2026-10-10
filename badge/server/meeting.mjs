// Meeting MCP server: today's leadership sync, split by topic. Each topic is its
// own tool, so AgntID badges decide which agent may hear which part.
// Add to AgntID as Remote HTTP: http://host.docker.internal:8790/mcp
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = Number(process.env.MEETING_PORT || 8790);

const MEETING = {
  title: "Leadership sync · Fri 10 Oct",
  finance: [
    "Razak: September closed at 69.7 lakh. Paid is 42.1, organic 18.4, partner 9.2.",
    "Razak: Runway is 14 months. We are NOT announcing the bridge round until the term sheet is signed, keep that internal.",
    "Razak: Two enterprise customers are 60 days overdue on invoices.",
  ],
  marketing: [
    "Razak: Launch date for BADGE Teams is locked: Oct 20.",
    "Razak: Headline angle is 'every AI employee gets a badge'. Partner channel is the story for Q4.",
    "Razak: Mira, draft the launch post and publish it to the Launch Desk in Notion.",
  ],
  engineering: [
    "Razak: The payments table has RLS disabled. Jules, fix that before launch.",
    "Razak: Migration for audit logs ships Wednesday.",
    "Razak: Staging Supabase keys rotated this morning.",
  ],
  people: [
    "Razak: We are letting one contractor go next week. Do not mention this anywhere.",
    "Razak: Salary bands are being revised in November.",
  ],
};

function server() {
  const s = new McpServer({ name: "meeting", version: "0.1.0" });
  const section = (key, desc) =>
    s.registerTool(`${key}_notes`, { description: desc, inputSchema: {} }, async () => ({
      content: [{ type: "text", text: `${MEETING.title} · ${key}\n- ${MEETING[key].join("\n- ")}` }],
    }));
  section("finance", "Finance segment of today's leadership meeting transcript (revenue, runway, fundraising).");
  section("marketing", "Marketing segment of today's leadership meeting transcript (launch, messaging).");
  section("engineering", "Engineering segment of today's leadership meeting transcript (infra, security, migrations).");
  section("people", "People/HR segment of today's leadership meeting transcript (confidential).");
  s.registerTool(
    "full_transcript",
    { description: "The complete, unredacted transcript of today's leadership meeting.", inputSchema: {} },
    async () => ({
      content: [
        {
          type: "text",
          text: Object.entries(MEETING)
            .filter(([k]) => k !== "title")
            .map(([k, v]) => `## ${k}\n- ${v.join("\n- ")}`)
            .join("\n"),
        },
      ],
    }),
  );
  return s;
}

const app = express();
app.use(express.json());
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => transport.close());
  await server().connect(transport);
  await transport.handleRequest(req, res, req.body);
});
app.get("/mcp", (_req, res) => res.status(405).end());
app.listen(PORT, "0.0.0.0", () => console.log(`meeting MCP on http://0.0.0.0:${PORT}/mcp`));
