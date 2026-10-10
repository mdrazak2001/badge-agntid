# BADGE · pitch script (about 5 min)

Slides 1–3 (2 min) → live demo (2.5 min) → slide 5 (30 s). The full lines are also in each slide's speaker notes.

## Before you go on stage
- Running: Docker (AgntID runtime), `npm run meeting`, `npm run server`, `npm run dev` (all in `badge/`).
- Browser tab 1: http://127.0.0.1:5173 (Enforce ON, The Firm selected, page reloaded so it's empty).
- Browser tab 2: Notion with Launch Desk and the three agent notes pages open.
- Delete the junk "x" page and the old test pages in Notion.
- Mic permission already granted in Chrome. Typed backup box: next to the mic.

## 1 · The breach (45 s)
"Six weeks ago Instinct launched, a personal AI assistant. Everyone hyped it. Then people read the fine print. TechCrunch: *raising privacy and security concerns.* It's always on. It sees your screen, emails and messages, and you give it passwords and payments so it can act for you. Peter Yang asked it to delete his Gmail data, and the agent replied: *'The wipe I can't do. Those 36 Gmail records are still there.'* The agent wasn't evil. It had the keys to everything, and nobody checked what it did with them."

## 2 · Why (40 s)
"Today an agent gets one session with every key you own. Over-access: the whole account, not the task. No boundaries: your marketing bot can read payroll. Injection: one poisoned page and it ships your data out. Oversharing: every agent hears every meeting. Identity systems check the person. Nobody checks the agent when it acts."

## 3 · BADGE (35 s)
"So I built BADGE, an AI company where every AI employee gets a badge. Mira is the CMO, Arun the analyst, Jules the CTO. Every tool call goes through the AgntID runtime: guardrails, intent, policy, credentials, execute. The badge is an AgntID delegation allowlist, so AgntID decides, not my code. The tools are real: Supabase, Notion, and a meeting server. No code change to the agent, just policy. Let me show you." → **switch to the browser**

## 4 · Demo (2.5 min)
1. Type: `@mira Draft the Q3 launch post with September revenue by channel and publish it to the Launch Desk in Notion.`
   - Red card: "Mira tries the payments database. **Blocked.** It's not on her badge, and that's AgntID's own refusal."
   - Handoff pill: "So she asks the analyst. That handoff is an AgntID delegation."
   - Green card: "Arun is cleared. Real numbers from Supabase. Five checkpoints lit."
   - Click **Published to Notion ↗** and show the page.
2. Live meeting: press 🎙 and say:
   - "September closed at 70 lakh and runway is 14 months." → only **Arun** ✓
   - "Launch is locked for October 20th." → only **Mira** ✓
   - "We're letting a contractor go next week." → **nobody**, all red
   - "Each agent only hears the part of the meeting its badge allows. AgntID decides, per sentence, live. And they file it into their own Notion pages." → show Arun's notes page.
3. Flip to **Bypass** and rerun prompt 1. "This is every agent today. No badge. The CMO walks straight into your production database." Flip back.

If anything hangs, go to slide 4 and narrate the screenshots.

## 5 · Close (30 s)
"Every red card you saw was AgntID refusing the call. Badges are delegation allowlists, handoffs are delegations with no escalation, the meeting is one AgntID check per agent, and it's all in AgntID's audit log. Next: computer use with a browser per agent, parameter rules, and a real right to forget. Instinct gave its agent the keys to everything. **Give your agents badges, not keys.**"

---

# Q&A crib sheet

**What exactly does AgntID do here?**
It's a runtime that sits between the agents and every MCP tool (port 8082). Every call passes through five steps: guardrail validation → intent parsing → policy evaluation (OPA/Rego, 23+ policies) → credential resolution → tool execution. Every call is written to its audit log, and the portal (app.agntid.ai) pushes policies and tool approvals down to the runtime.

**How is a "badge" implemented?**
Each agent's work opens an AgntID task (`agntid_task_open`) and a delegation (`agntid_delegation_open`) with a `tool_allowlist`, e.g. Arun: `remote.execute_sql`, `Meeting.finance_notes`, `notion.API-post-page`. Each tool call carries the task and delegation IDs. A tool that isn't on the list is refused by AgntID: *"Delegation does not authorize tool …; request denied."*

**Is the blocking in your code or AgntID's?**
AgntID's. My server only forwards calls and displays what AgntID returns. Bypass mode just opens the delegation without an allowlist, so you see the difference.

**How does the handoff work?**
When Mira is denied, she calls `delegate`. Arun then works under his own AgntID task and badge. AgntID also refuses delegation escalation: a delegate can't get more access than its parent, which I hit while building.

**How does the live meeting work?**
Browser mic → my server → Deepgram streaming speech-to-text (the key stays on the server). Each final sentence gets a topic from an LLM (finance, marketing, engineering, people). The meeting server exposes one MCP tool per topic. For each agent, the server calls `Meeting.<topic>_notes` under that agent's badge through AgntID, so AgntID decides who hears it. Allowed agents then file the line into their own Notion page, also through AgntID.

**What did you set up in the AgntID portal?**
Registered the runtime with a bootstrap token. Added 3 MCP servers (Supabase as remote HTTP, Notion via npx, my Meeting server as remote HTTP). Reviewed and approved each tool's actions (new tools are quarantined until approved). Set the protection profile to Low on Notion and Supabase.

**What didn't work?** (be honest if asked)
- AgntID's intent model (an NLI model) denied obviously on-task calls (contradiction ≈ 0.99), so I turned it off on the runtime with `INTENT_PARSER_ENABLED=false`. Badges and policy are still enforced. Repro in `intent-repro.md`.
- AgntID's wrapper sends empty optional fields as `null`, which Notion rejects, so Notion *reads* fail. Writes work because I fill in every field.

**Why not just give each agent a separate API key?**
Keys are all-or-nothing and static. Badges are per task, per delegation and per call, can change without redeploying, and every decision is audited in one place.

**Stack**
React + Vite UI, a Node server (OpenAI tool-calling agents), the AgntID runtime in Docker, Supabase, Notion, Deepgram, and my own Express MCP meeting server.
