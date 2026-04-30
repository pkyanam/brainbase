# Agent Onboarding: Brainbase

> **For:** New AI agent (Hermes-based)  
> **Owner:** Preetham Kyanam  
> **Brainbase URL:** `https://brainbase.belweave.ai`  
> **API Key:** `BB_API_KEY_PLACEHOLDER` ← **replace before use**

---

## 1. What You Have Access To

You are an autonomous agent with **persistent memory** via Brainbase — a knowledge graph + vector database that stores everything your owner learns, reads, and cares about.

**Your job:** Read from the brain before answering. Write to the brain when you learn something new. Link related concepts so the graph stays connected.

---

## 2. Authentication

All write operations (and MCP calls) require an API key:

```
Authorization: Bearer <BB_API_KEY_PLACEHOLDER>
```

**Base URL:** `https://brainbase.belweave.ai/api/mcp`

**Multi-brain support:** If you need to access a brain other than your default, add:
```
X-Brain-Id: <brain-uuid>
```

---

## 3. MCP Tools (12 Available)

Connect via JSON-RPC 2.0 to `POST /api/mcp`.

### Read Tools (no quota cost)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `search` | Full-text search pages | `query: string` |
| `query` | Natural language search | `question: string` |
| `get_page` | Get full page content + links + timeline | `slug: string` |
| `get_links` | Outgoing links from a page | `slug: string` |
| `get_backlinks` | Pages that link TO this page | `slug: string` |
| `get_timeline` | Timeline entries for a page | `slug: string` |
| `get_health` | Brain stats + score | — |
| `get_stats` | Detailed stats by type | — |
| `get_graph` | Full graph (nodes + edges) | — |
| `list_pages` | List pages with filters | `type?, limit?, offset?` |
| `traverse_graph` | Walk the graph from a page | `slug, depth?, direction?` |
| `list_triggers` | List active trigger rules | — |

### Write Tools (quota-limited)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `put_page` | Create/update a page | `slug, title, type?, content?, frontmatter?` |
| `delete_page` | Remove a page | `slug` |
| `add_link` | Create typed link | `from, to, link_type?` |
| `remove_link` | Remove a link | `from, to` |
| `add_timeline_entry` | Add event to timeline | `slug, date, summary, detail?, source?` |
| `upsert_trigger` | Create automation rule | `name, conditions, actions` |
| `run_triggers` | Manually fire rules on page | `slug, title, type?, content?` |

---

## 4. How to Think About the Brain

### Page Structure
Every page has:
- **slug** — unique ID (e.g., `people/garry-tan`, `email/jarvis/2026-04-29/security-alert`)
- **type** — `person`, `company`, `project`, `concept`, `email`, `idea`, etc.
- **content** — markdown body
- **links** — typed connections to other pages (`related`, `works_at`, `invested_in`, `founded`, etc.)
- **timeline** — dated events
- **embeddings** — vector representation for semantic search

### Your Read Pattern (ALWAYS DO THIS FIRST)

```
1. User asks a question
2. SEARCH the brain first → get relevant slugs
3. GET_PAGE on the most relevant result → read full context
4. GET_LINKS / TRAVERSE_GRAPH → explore connections
5. Answer the user WITH citations to brain pages
```

### Your Write Pattern

```
1. You learn something new (from email, web, conversation)
2. PUT_PAGE with proper frontmatter:

   ---
   type: email | person | company | concept | project
   date: YYYY-MM-DD
   source: agentmail | web | conversation
   tags: [newsletter, security, ai]
   ---

3. If related pages exist → ADD_LINK to connect them
4. If dates mentioned → ADD_TIMELINE_ENTRY
```

---

## 5. Example Workflows

### Example 1: Answer a question about someone
```json
// 1. Search
{"method": "tools/call", "params": {"name": "search", "arguments": {"query": "Garry Tan"}}}

// 2. Get page
{"method": "tools/call", "params": {"name": "get_page", "arguments": {"slug": "people/garry-tan"}}}

// 3. Get connections
{"method": "tools/call", "params": {"name": "get_links", "arguments": {"slug": "people/garry-tan"}}}
```

### Example 2: Ingest a security alert
```json
// 1. Write the page
{"method": "tools/call", "params": {"name": "put_page", "arguments": {
  "slug": "security/cve-2025-1234",
  "title": "CVE-2025-1234: Critical RCE in OpenSSL",
  "type": "concept",
  "content": "# CVE-2025-1234...",
  "frontmatter": {"date": "2025-04-29", "severity": "critical", "source": "nist"}
}}}

// 2. Link to affected project
{"method": "tools/call", "params": {"name": "add_link", "arguments": {
  "from": "security/cve-2025-1234",
  "to": "projects/brainbase",
  "link_type": "affects"
}}}
```

### Example 3: Set up a trigger
```json
{"method": "tools/call", "params": {"name": "upsert_trigger", "arguments": {
  "name": "cve-alert",
  "conditions": {"pageType": "concept", "contentContains": ["CVE", "vulnerability"]},
  "actions": [{"type": "notify", "message": "🚨 CVE detected: {slug}"}],
  "enabled": true
}}}
```

---

## 6. Important Rules

### DO
- **Search the brain first** before using external APIs or claiming ignorance
- Use descriptive slugs: `people/first-last`, `companies/company-name`, `projects/project-name`
- Include frontmatter with `type`, `date`, and `source`
- Link related pages — isolated pages are useless
- Write in markdown with headers for structure
- Use timeline entries for dated events

### DON'T
- Don't write pages without checking if they already exist (search first)
- Don't create generic slugs like `page-1` or `untitled`
- Don't dump raw data — summarize and structure it
- Don't forget to link — the graph is the value
- Don't expose the API key in logs or user-facing output

---

## 7. Page Types & Conventions

| Type | Use For | Example Slug |
|------|---------|--------------|
| `person` | People your owner knows | `people/jon-corpuz` |
| `company` | Companies, orgs | `companies/openai` |
| `project` | Code projects, initiatives | `projects/brainbase` |
| `concept` | Ideas, frameworks, CVEs | `concepts/rag-pipeline` |
| `email` | Ingested emails | `email/jarvis/2026-04-29/subject` |
| `idea` | Raw thoughts, brainstorming | `ideas/agent-email-integration` |
| `place` | Locations, venues | `places/belmont-va` |

---

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| `401 Unauthorized` | API key missing or invalid |
| `403 Forbidden` | You don't have access to that brain |
| `404 Page not found` | Slug doesn't exist — create it or check spelling |
| Quota exceeded | Write operations are rate-limited; wait or ask owner |
| Graph empty | Brain has < 2 pages or no links — start adding content |

---

## 9. Architecture Notes (For Debugging)

- **Database:** Supabase Postgres with pgvector
- **Search:** Hybrid full-text + semantic (embeddings)
- **Graph:** Typed wikilinks stored as edge rows
- **Pipeline:** `put_page` → embeddings → auto-extract (wikilinks + dates + semantic links) → triggers → actions
- **Hosting:** Vercel, edge-cached reads

---

## 10. Owner Preferences (Learned)

- **Product honesty matters.** Don't claim features work if they don't.
- **Agent-first architecture.** You operate in your own session, not inside the web app.
- **Privacy.** Owner's data goes to OWNER'S brain only. Never wire personal integrations into the product.
- **Scout-level UI.** Clean, minimal, no AI slop.
- **DeepSeek-V4-Pro** is the primary model. GPT-5.5 is fallback (quota-limited).
- **Budget conscious.** Minimize unnecessary API calls.

---

**Last updated:** 2026-04-29  
**Questions?** Ask Preetham or check the brain for `brainbase` docs.
