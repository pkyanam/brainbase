# Skills File Spec — Brainbase

> Tom Blomfield's phrase, implemented. A queryable, attributed subgraph scoped to a task.

## What it is

A **skills file** is a structured context document that tells an AI agent how to handle a specific task at a specific company. It's not a document dump. It's a distilled, confidence-scored, attributed map of the relevant rules, people, precedents, and exceptions.

## Schema

```ts
interface SkillsFile {
  /** What task this skills file covers */
  task: string;

  /** How confident we are in this file overall (0-1) */
  confidence: number;

  /** Which source systems contributed */
  sources: string[];

  /** When this skills file was generated */
  generatedAt: string;

  /** Relevant people with roles */
  people: {
    name: string;
    role: string;
    slackHandle?: string;
    email?: string;
    involvement: "owner" | "approver" | "informed";
  }[];

  /** Decision rules extracted from company data */
  rules: {
    condition: string;
    action: string;
    owner?: string;
    /** How many precedent decisions support this rule */
    precedents: number;
    /** Confidence in this specific rule (0-1) */
    confidence: number;
    /** Source page slugs that back this rule */
    sources: string[];
  }[];

  /** Unwritten rules detected from pattern analysis */
  implicitRules: {
    observation: string;
    evidence: string;
    confidence: number;
  }[];

  /** Timeline of relevant decisions */
  precedents: {
    date: string;
    summary: string;
    outcome: string;
    confidence: number;
  }[];

  /** Known exceptions and edge cases */
  exceptions: {
    condition: string;
    handling: string;
    source: string;
  }[];
}
```

## How it's generated

1. **Scope**: User specifies a task (e.g., "pricing exceptions")
2. **Query**: Brainbase searches for related pages, links, timeline entries
3. **Traverse**: Walk the graph from seed pages to find connected people, decisions, rules
4. **Score**: Confidence based on recency, source reliability, agreement across sources
5. **Export**: Structured JSON consumed by the agent as system context

## Example output

```json
{
  "task": "pricing_exception",
  "confidence": 0.94,
  "sources": ["slack", "linear", "email"],
  "generatedAt": "2026-04-29T18:00:00Z",
  "people": [
    { "name": "Alice Chen", "role": "Sales Manager", "slackHandle": "@alice", "involvement": "owner" },
    { "name": "Bob Kim", "role": "Legal", "slackHandle": "@bob", "involvement": "approver" }
  ],
  "rules": [
    {
      "condition": "deal_value < 50000",
      "action": "Sales manager approves directly",
      "owner": "Alice Chen",
      "precedents": 23,
      "confidence": 0.97,
      "sources": ["decisions/pricing-under-50k", "slack/sales/123-456"]
    },
    {
      "condition": "deal_value >= 100000",
      "action": "Legal review required. Escalate to Bob.",
      "owner": "Bob Kim",
      "precedents": 8,
      "confidence": 0.91,
      "sources": ["decisions/pricing-over-100k", "slack/legal/789-012"]
    }
  ],
  "implicitRules": [
    {
      "observation": "Deals over $100k always get legal review, but the threshold was never formally documented",
      "evidence": "8/8 precedent decisions over $100k involved legal, 0/23 under $50k did",
      "confidence": 0.95
    }
  ],
  "precedents": [
    { "date": "2026-04-15", "summary": "Acme Corp $120k deal", "outcome": "Approved after legal review", "confidence": 1.0 }
  ],
  "exceptions": [
    { "condition": "Existing customer renewal", "handling": "Can bypass legal if same terms", "source": "slack/sales/456-789" }
  ]
}
```

## Why this matters

A skills file is the missing layer between raw company data and reliable AI automation. It tells an agent:
- **What** the rule is
- **Who** owns it
- **How confident** we are
- **Where** it came from
- **When** it was last true

Without this, agents hallucinate process. With it, they execute consistently.
