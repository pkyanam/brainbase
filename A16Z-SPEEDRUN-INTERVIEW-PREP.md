# A16Z Speedrun SR007 — Interview Prep
> Preetham Kyanam | Brainbase | brainbase.belweave.ai  
> Updated: May 2, 2026  
> Core positioning: **Brainbase is the hosted knowledge graph + API layer for agent memory. MCP is supported, but the wedge is SDK/CLI/REST/API-native agent access.**

---

## 0. What changed from the old prep

The previous prep had the right product instinct but the wrong market timing language.

**Do not say:** "MCP just became the standard in the last 6 months."  
Anthropic announced MCP on November 25, 2024. As of this interview cycle, MCP is not new. It is infrastructure people now expect.

**Better framing:**

> MCP was the bridge that made tool access legible. The next phase is programmable agent infrastructure: APIs, SDKs, CLIs, tool catalogs, and code-executed workflows. Brainbase meets that shift because it is not just an MCP server. It is a hosted knowledge graph with REST, TypeScript SDK, CLI, and MCP compatibility.

**The real “why now”:**

1. AI agents are becoming code-executing workers, not chatbots.
2. Tool access is moving from hand-wired integrations into programmable APIs, SDKs, CLIs, and dynamic tool catalogs.
3. These agents still lack reliable long-term memory, entity resolution, typed relationships, and timeline-aware context.
4. GBrain proved developers want graph memory. Brainbase packages the pattern as hosted infrastructure.

**MCP stance for the interview:**

> MCP is not the moat. MCP is the compatibility layer. The moat is the graph, the API ergonomics, the SDK/CLI distribution, and the data model that gets better as agents use it.

---

## 1. One-minute company answer

> Brainbase is a hosted knowledge graph API for AI agents. It gives agents persistent, structured memory across sessions, tools, and workflows.
>
> The key difference is that we are not building another vector database or RAG wrapper. Vector search gives you similar chunks. Brainbase gives you entities, typed relationships, backlinks, timelines, and graph traversal. An agent can ask, “What did we decide about pricing?” or “Who is connected to this customer?” and get structured memory back through the REST API, TypeScript SDK, CLI, or MCP.
>
> MCP is supported, but I do not think MCP alone is the future wedge. The market is moving toward programmable agent access: SDKs, CLIs, direct APIs, tool search, and code-executed workflows. Brainbase is built for that world. It is a memory backend agents can call directly, not a plugin demo.

---

## 2. Quick-reference fact sheet

| Category | Current interview-safe version |
|---|---|
| Product | Hosted knowledge graph API for AI agent memory |
| One-liner | **Persistent graph memory for AI agents.** |
| Main wedge | API/SDK/CLI-first memory infrastructure with MCP compatibility |
| Interfaces | REST API, TypeScript SDK, CLI, MCP JSON-RPC server |
| Core architecture | Supabase Postgres + pgvector, typed links, timeline entries, hybrid search, graph traversal |
| Public repo | `github.com/pkyanam/brainbase` |
| Repo status visible publicly | Public repo, 1 star, 0 forks, 100 commits visible from GitHub during this update |
| Public README claim | “The memory layer for AI agents. One API call, and every agent in your stack remembers everything.” |
| MCP tools in README | 12 tools: search, query, get_page, get_links, get_backlinks, get_timeline, get_health, get_stats, get_graph, list_pages, traverse_graph, list_triggers |
| Stack visible in README | Next.js 16, React 19, Tailwind v4, Three.js, Supabase Postgres + pgvector, Clerk, OpenAI `text-embedding-3-small`, Vercel |
| Built on / inspired by | GBrain patterns, but Brainbase is hosted + multi-interface rather than a self-hosted personal brain |
| GBrain current public signal | 12.7k GitHub stars, 1.6k forks, 127 commits visible during this update |
| Current stage | Live early product, pre-revenue / pre-scale, solo founder |
| Pricing to discuss | Free / Pro / Enterprise, but treat exact limits as flexible until validated by users |
| Speedrun SR007 | Applications close May 17, 2026, 11:59pm PT; cohort runs July 27 – Oct 11, 2026 |
| Speedrun terms | Up to $1M: $500K for 10% upfront SAFE + $500K in next round within 18 months; $5M+ partner credits |

### Numbers to verify right before the call

Use these only if they are still true in the live dashboard or repo:

- Production brain pages
- Typed links
- Brain score
- Link coverage
- Search MRR
- Current npm package versions
- Current commit count
- External users / pilots / revenue

If asked and you have not verified the live number, say:

> The exact live count moves daily because the brain self-enriches. The important thing is that this is real data in production, not seed content. I can show the current dashboard live.

---

## 3. The updated “why now”

### Short answer

> The agent stack is moving from chat UX to programmable workers. Claude Code, OpenAI Agents SDK, Claude Agent SDK, and similar systems can inspect files, run commands, edit code, call APIs, and operate over long workflows. But the memory layer is still missing. Developers either dump chunks into a vector DB or wire custom databases. Brainbase is the hosted graph memory layer built for that new programmable agent workflow.

### Longer answer

> MCP mattered because it made tool access easier to standardize. But MCP is no longer the novel insight. It is becoming table-stakes plumbing. The next wave is agents that call tools programmatically, run inside sandboxes, use SDKs, invoke CLIs, and search huge tool catalogs dynamically.
>
> That shift makes memory more important, not less. If an agent can run commands and operate across files, it needs to remember prior decisions, people, entities, projects, customers, and timelines. A vector DB can retrieve similar text. A graph memory system can answer relationship questions and preserve institutional context.
>
> Brainbase exists because every serious agent eventually needs the same thing: a reliable place to read and write structured memory.

### Key supporting facts to know

- MCP was announced by Anthropic in November 2024 as an open standard for connecting AI systems to data sources and tools.
- Anthropic later described MCP as widely adopted across products and infrastructure, while also launching tool search and programmatic tool calling for production-scale tool use.
- Anthropic’s MCP connector lets developers connect remote MCP servers directly from the Messages API, which shows MCP is being absorbed into API workflows rather than remaining only a local desktop config pattern.
- Anthropic’s programmatic tool calling lets Claude write code that calls tools inside code execution to reduce latency and token use.
- OpenAI’s Agents SDK emphasizes agents that own orchestration, tool execution, approvals, and state.
- Claude Agent SDK exposes Claude Code-style file reading, command execution, code editing, and context management through Python and TypeScript.

### Interview line

> The market moved from “Can my model call a tool?” to “Can my agent operate reliably over time?” Brainbase is for the second question.

---

## 4. The 15 questions you are likely to get

### 1. What are you building?

> Brainbase is a hosted knowledge graph API for AI agents. It gives agents persistent memory they can query through REST, SDK, CLI, or MCP.
>
> The product is built around the idea that agent memory should be structured, not just embedded. We store pages, chunks, typed links, backlinks, timelines, and graph relationships. So instead of returning “similar text,” Brainbase can answer relationship-heavy questions like who works where, what depends on what, what changed last week, and what decisions were made.
>
> The short version: it is Postgres-like trust and graph-like context, packaged like Stripe or Supabase for agent memory.

### 2. Why is this not just a vector database?

> Vector DBs are great for similarity search. They are bad at memory.
>
> Memory needs structure: entities, relationships, chronology, provenance, and updates over time. If an agent asks “Who owns onboarding?” or “What decisions depend on this vendor?” vector search can return semantically similar chunks, but it does not understand the graph.
>
> Brainbase still uses embeddings where they help, but embeddings are one retrieval signal. The product is the graph memory layer around them.

### 3. Why now?

> Agents are becoming programmable workers. They can read files, run commands, edit code, use sandboxes, and call tools. That makes memory a core infrastructure problem.
>
> MCP helped standardize tool access, but the market is already moving beyond “just connect a tool” into SDKs, CLIs, programmatic tool calling, dynamic tool search, and direct API orchestration. Those agents need a memory backend that is structured and durable.
>
> Brainbase is built exactly for that: API-first, CLI-friendly, SDK-friendly, and MCP-compatible.

### 4. Is MCP going away?

> I would not say MCP is dead. I would say MCP is becoming plumbing.
>
> It is useful as a compatibility layer. Brainbase supports it because developers expect their tools to plug into Claude Code, Cursor, OpenCode, ChatGPT desktop, and other agent surfaces. But I do not want the company to be “an MCP server company.” The real product is the graph memory API.
>
> If MCP changes, Brainbase still works through REST, SDK, CLI, and direct API access.

### 5. Why not just use GBrain?

> GBrain is powerful and proved that graph memory for agents is real. But it is mostly a self-hosted, opinionated personal brain pattern.
>
> Brainbase turns that pattern into hosted infrastructure: multi-interface, API-first, auth-aware, tenant-aware, and usable by developers who do not want to run their own Postgres, embeddings, graph linking, cron jobs, and eval loops.
>
> The analogy is not “we compete with GBrain.” It is closer to: GBrain proves the developer behavior; Brainbase productizes it.

### 6. Why you?

> I live inside this problem. I run multiple agents and hit the same failure mode constantly: they can act, but they cannot remember. I have built agent tooling, CLIs, MCP servers, and full-stack products. I also saw enterprise knowledge-loss problems in IT consulting.
>
> More importantly, I ship. Brainbase is live, public, and has REST, SDK, CLI, MCP, a 3D graph UI, and a real production brain. I did not wait for the perfect co-founder or the perfect market map. I built the missing piece I needed.

### 7. What traction do you have?

Use this structure. Fill exact numbers live:

> We are early and I will be direct: this is not a revenue story yet. It is a product velocity and earned-insight story.
>
> What exists now: a live hosted product, public repo, SDK, CLI, MCP server, REST API, 3D graph visualization, and a production brain I dogfood with my own agents.
>
> The key traction is that I built this from real usage. The graph contains real agent memory and the product is already usable. The next milestone is external pilots: 5–10 developers or small AI-native teams using Brainbase as their shared agent memory backend.

Only add metrics after checking the current dashboard:

> Current live numbers are: [pages], [typed links], [MRR/eval score], [agents connected], [external users/pilots].

### 8. Who is the customer?

> The first customer is the AI-native developer or small team running multiple agents: Claude Code, Cursor, OpenCode, custom Slack/Telegram agents, internal support agents, or coding agents.
>
> These users do not need a huge enterprise knowledge platform. They need a dead-simple memory backend agents can call immediately.
>
> Start with solo developers and tiny teams because they adopt fast. Expand into startups and companies once the graph becomes institutional memory.

### 9. How do you get your first 100 users?

> I would focus on developers already feeling memory pain, not generic AI hype.
>
> First: GBrain-adjacent and agent-tooling communities. These people already understand the problem.
>
> Second: content and demos showing failures of vector-only memory versus graph memory. Show the same question answered by vector search and by Brainbase.
>
> Third: CLI-first onboarding. A developer should be able to run `brainbase init`, add one API key, and query memory in minutes.
>
> Fourth: pilots with AI-native teams using Claude Code, Cursor, OpenCode, or custom internal agents.

### 10. What is the business model?

> Freemium SaaS. The free tier gets developers using it with a real small brain. Pro is for serious solo developers and tiny teams. Enterprise is for companies that need SSO, dedicated infrastructure, auditability, and higher limits.
>
> Longer term, usage-based pricing makes sense around API calls, enrichment, embedding, and graph scale. But early on, simple pricing matters more than perfect metering.

### 11. What is the hardest technical problem?

Use the orphan-linker answer, but tighten it:

> The hardest part has been making the graph wire itself cheaply.
>
> When you ingest knowledge, a lot of pages start as islands. If they stay isolated, graph traversal is useless. The naive approach is to compare every orphan page against every target page with vector similarity, but that explodes quickly and fails on serverless timeouts.
>
> The fix was a staged linker: indexed pgvector KNN, full-text fallback, title/entity overlap fallback, and batch-safe job execution. The principle is simple: use expensive intelligence only where it matters, and let cheap deterministic passes do the rest.
>
> That matters because Brainbase cannot require a human to manually curate links. The graph has to improve while agents use it.

### 12. What if OpenAI, Anthropic, or Cursor builds memory?

> They probably will build memory for their own products. That validates the category.
>
> Brainbase wins by being model-agnostic and workflow-agnostic. Developers are not going to run one model, one IDE, one agent, and one vendor forever. They will use Claude Code, Cursor, OpenAI, local models, custom tools, and internal agents together.
>
> The company memory layer should not belong to one model vendor. It should be portable infrastructure.

### 13. Why will this become a big company?

> If agents become coworkers, memory becomes infrastructure.
>
> Every serious team will need a shared substrate where agents can remember decisions, relationships, customers, projects, errors, policies, and source-backed facts. That memory cannot just be chat history. It has to be structured, queryable, permissioned, and durable.
>
> The wedge is developer memory for agents. The bigger company is the institutional brain for AI-native organizations.

### 14. Why solo?

> I am actively looking for the right co-founder, but I did not want co-founder search to become an excuse not to ship.
>
> The product exists because I built it. Speedrun says solo founders can apply, and the bar is execution. My case is that I have unusually high founder-market fit and product velocity. The right co-founder would help with backend/infra scale or GTM, but Brainbase is already moving.

### 15. What changed since the application?

Use this if they noticed the application overemphasized MCP:

> My thinking sharpened. I still think MCP matters, but I no longer think “MCP-native” is enough of a wedge. MCP is becoming table stakes. The stronger positioning is Brainbase as an API-first graph memory backend with MCP as one adapter.
>
> That is actually a stronger company. It means Brainbase is not dependent on one protocol trend. Agents can access it through REST, SDK, CLI, or MCP.

---

## 5. Tough objections and strong rebuttals

### “This sounds like RAG.”

> RAG is usually document retrieval. Brainbase is memory infrastructure. RAG returns chunks. Brainbase returns entities, links, timelines, backlinks, and graph paths. Retrieval is one feature; memory is the product.

### “Why would developers pay instead of just using Postgres?”

> They can use Postgres. Brainbase exists because the hard part is not storing rows. The hard part is building the ingestion pipeline, embedding, full-text search, typed links, graph traversal, evals, auth, API surface, CLI, SDK, and self-maintenance loop. Developers pay because they want agent memory, not a database chores project.

### “Isn’t MCP becoming crowded?”

> Yes. That is why I do not want to be positioned as just another MCP server. Brainbase is a memory backend with MCP compatibility. Crowding in MCP actually helps because it creates demand for structured tool catalogs and memory systems that can operate across tools.

### “How do you avoid becoming a feature?”

> By owning the cross-agent memory layer. A feature inside Claude or Cursor remembers one product’s context. Brainbase remembers across Claude Code, Cursor, OpenAI agents, custom CLIs, Slack bots, Telegram agents, and internal workflows. The value increases with every surface connected.

### “Where is the moat?”

> Early moat is velocity and developer love. Product moat is accumulated graph structure: typed relationships, historical timelines, source-backed pages, and agent-written memory. Once a team’s agents depend on that graph, switching is not just moving embeddings. It is moving institutional memory.

### “What is your riskiest assumption?”

> That developers will adopt a dedicated memory layer before the pain becomes unbearable. The way to test it is simple: get 10 AI-native teams using Brainbase with their actual agents and measure whether they keep writing memory into it after the novelty fades.

---

## 6. Demo narrative: API-first, not MCP-first

### 60-second demo script

```text
[0–8s] Hook
Every AI agent is getting better at taking actions, but they still forget.
This is the missing layer: persistent graph memory.

[8–20s] API moment
Show a simple SDK or REST query:
brainbase.query("what did we decide about pricing?")
Return structured results: page, source, links, timeline, related entities.

[20–35s] Graph moment
Open the graph view.
Show that this is not chunks in a vector DB.
Click an entity and show typed links: works_at, authored_by, depends_on, decided_on, related_to.

[35–48s] Multi-surface moment
Show the same memory accessible through:
- CLI command
- SDK/API call
- MCP config
Say: MCP is supported, but the product is the graph memory backend.

[48–60s] Close
Agents are becoming programmable workers.
Workers need memory.
Brainbase is persistent graph memory for the agent era.
```

### Demo order

1. **SDK/REST first** — establishes this is infrastructure.
2. **CLI second** — shows developer ergonomics.
3. **Graph UI third** — gives the visual “aha.”
4. **MCP last** — compatibility, not core identity.

---

## 7. Updated one-liners

Use these instead of the old MCP-heavy lines:

> Persistent graph memory for AI agents.

> Brainbase is the hosted memory layer agents can call through API, SDK, CLI, or MCP.

> Vector DBs retrieve chunks. Brainbase remembers relationships.

> MCP is the adapter. The graph is the product.

> Agents are becoming programmable workers. Brainbase gives them durable memory.

> Not another MCP server. The memory backend behind the agents.

> A company brain that agents can read from and write to.

---

## 8. Do-not-say list

Avoid these in the interview:

- “MCP was released in the last 6 months.” It was announced in November 2024.
- “MCP is the moat.” MCP is an adapter and compatibility surface.
- “MCP is dead.” Too absolute. Say it is becoming plumbing and API-native access is where production usage is moving.
- “GPT-5.4-nano” unless you can prove that exact model exists and is used in your product.
- “Millions of developers use X daily” unless you have a current, sourced number.
- “We have no competitors.” You do: vector DBs, memory startups, model vendors, GBrain/self-hosting, and generic databases.
- “We are the hosted GBrain.” Better: “GBrain proved the pattern; Brainbase productizes hosted graph memory for developers.”
- “The product works, distribution is the only risk.” Stronger: “The product exists; the risk is proving repeat usage and conversion outside my own workflow.”

---

## 9. Questions to ask a16z

Pick two or three.

1. “What would you want Brainbase to prove by Demo Day: external pilots, revenue, usage depth, or a sharper wedge?”
2. “For devtools companies in Speedrun, what has separated companies that got real pull from companies that only got GitHub attention?”
3. “How would you think about positioning this: agent memory, company brain, or knowledge graph infrastructure?”
4. “Who in the a16z network is building heavily with agents and would be a brutal design partner?”
5. “What would make you nervous about this category?”

---

## 10. Day-of checklist

- [ ] Verify live dashboard numbers.
- [ ] Verify GitHub commit count and public repo status.
- [ ] Verify npm package names and versions.
- [ ] Have API/SDK demo working locally.
- [ ] Have CLI demo working.
- [ ] Have MCP demo ready, but do not lead with it.
- [ ] Have a clean 60-second demo video link.
- [ ] Have a 30-second answer for “What changed since your application?”
- [ ] Be ready to say “pre-revenue” plainly if true.
- [ ] Be ready to explain why this becomes a company, not a feature.

---

## 11. Source audit used for this update

These sources were checked while updating this file. Use them for confidence, not as interview footnotes.

### A16Z Speedrun

- `https://speedrun.a16z.com/apply` — SR007 application deadline, cohort dates, up to $1M, $5M+ credits.
- `https://speedrun.a16z.com/faq` — program structure, solo founder eligibility, standard deal terms, selection criteria.

### MCP and agent tool direction

- `https://www.anthropic.com/news/model-context-protocol` — MCP announcement and original positioning.
- `https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation` — MCP ecosystem/adoption, registry, SDKs, tool search and programmatic tool calling language.
- `https://platform.claude.com/docs/en/agents-and-tools/mcp-connector` — remote MCP servers directly from Claude Messages API.
- `https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling` — programmatic tool calling reduces latency and token use.
- `https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool` — dynamic tool discovery and context savings for large tool catalogs.
- `https://developers.openai.com/api/docs/guides/agents` — OpenAI Agents SDK framing around orchestration, tool execution, approvals, and state.
- `https://openai.com/index/the-next-evolution-of-the-agents-sdk/` — OpenAI sandbox agents and long-horizon tool/file/code workflows.
- `https://code.claude.com/docs/en/agent-sdk/overview` — Claude Code SDK renamed Claude Agent SDK; programmable file/command/code agent workflows.
- `https://code.claude.com/docs/en/mcp` — Claude Code still supports MCP for external tools and data sources.

### Brainbase / GBrain

- `https://github.com/pkyanam/brainbase` — public Brainbase README, architecture, tools, stack, repo status.
- `https://github.com/garrytan/gbrain` — public GBrain README, stars/forks, graph memory pattern, benchmark claims.

---

## 12. Final mental model

The strongest interview frame is:

> Agents are crossing from chat into execution. Execution needs memory. Memory cannot just be vectors. Brainbase is the hosted graph memory layer agents can call programmatically.

The cleanest investor translation is:

> If agents become coworkers, Brainbase becomes the shared company brain they all read and write.
