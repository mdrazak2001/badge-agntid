# AgntID intent_parsing repro (captured 2026-10-10 ~13:50 IST, before INTENT_PARSER_ENABLED=false)

Runtime 7a78b0d8-dcf7-4513-bbf3-e3cee3dc22c9 · v2.0.0 · intent parser cross-encoder/nli-deberta-v3-base · profile Low (Override) on notion + remote

```
### 1. agntid_task_open
{ "agent_id": "cmo", "user_id": "founder",
  "prompt": "Read the Notion launch roadmap and draft launch copy" }
→ ok: true · relevant_tool_names includes "notion_API-post-search"

### 2. notion_API-post-search { "query": "Q3 roadmap", "page_size": 10 }
→ isError: true
→ intent_parsing: failed · deny · CONTRADICTION_DETECTED
  "NLI contradiction (entailment=0.003, contradiction=0.994)"
→ guardrail_validation:passed > intent_parsing:failed > policy_evaluation:skipped

### 3. remote_execute_sql { "query": "SELECT channel, sum(amount) FROM payments GROUP BY 1" }
→ isError: true
→ "NLI contradiction (entailment=0.001, contradiction=0.999)"
```

Ask: the shortlist marks post-search as relevant, yet NLI denies it with contradiction 0.994.
Is this a known NLI-tier issue? How do we run intent validation monitor-only?
