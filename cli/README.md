# Brainbase CLI

Terminal-native CLI for [Brainbase](https://brainbase.belweave.ai) — query and manage your knowledge graph.

## Install

```bash
npm install -g brainbase-cli
```

## Configure

```bash
brainbase config set apiKey bb_live_your_key_here
brainbase config set baseUrl https://brainbase.belweave.ai   # default
brainbase config set brainId your-brain-uuid                 # optional
```

Config is stored in `~/.brainbase/config.json`. Priority: CLI flags > env vars > config file.

## Usage

### Read

```bash
# Search
brainbase search "garry tan"
brainbase search "pricing exceptions" --json | jq '.[].slug'

# Natural language query
brainbase query "who invested in Anthropic"

# Ask (LLM-generated answer with cited sources)
brainbase ask "who handles refunds?"

# Brain health
brainbase health
brainbase stats

# Pages
brainbase page people/garry-tan
brainbase list --type person --limit 10
brainbase list --written-by lara

# Graph
brainbase links people/garry-tan
brainbase traverse people/garry-tan --depth 3 --direction both
brainbase graph --json | jq '.nodes | length'

# Timeline & history
brainbase timeline people/garry-tan
brainbase versions people/garry-tan

# Tags
brainbase tags people/garry-tan
brainbase tags people/garry-tan --add founder
brainbase tags people/garry-tan --remove founder

# Provenance data
brainbase raw-data people/satya-nadella
brainbase raw-data people/satya-nadella --source brave
```

### Write

```bash
# Pages
brainbase put-page ideas/new-thing "My Idea" --type idea --content "# Hello"
echo "# Markdown from stdin" | brainbase put-page ideas/stdin-test "Test" --stdin

# Links
brainbase add-link people/garry-tan companies/y-combinator --type works_at
brainbase remove-link people/garry-tan companies/old-company

# Timeline
brainbase add-timeline people/garry-tan "2024-03-01" "Became YC CEO" --source "https://techcrunch.com/..."

# Cleanup
brainbase delete-page ideas/obsolete
```

### Enrichment

```bash
# Standard enrichment (Tier 2 — Brave web search + OpenAI, <10s)
brainbase enrich "Satya Nadella" --type person --tier 2

# Auto-detect type (works for Stripe, OpenAI, Vercel...)
brainbase enrich "Stripe" --tier 2

# With context (richer pages)
brainbase enrich "Tom Blomfield" --type person --context "YC partner, ex-Monzo CEO"

# Deep research (Tier 1 — async, returns job ID)
brainbase enrich "Garry Tan" --tier 1

# Force re-enrich (skip 7-day guard)
brainbase enrich "Garry Tan" --force

# Quick lookup (Tier 3 — OpenAI only, <5s)
brainbase enrich "Jane Doe" --tier 3
```

### Jobs

```bash
brainbase jobs                  # list all jobs
brainbase jobs --status active  # filter by status
brainbase jobs 42               # get specific job status
```

### API Keys

```bash
brainbase api-keys                           # list all keys
brainbase api-keys --create "my-new-key"     # create (full key shown once!)
brainbase api-keys --revoke key-id-123       # revoke
```

### Config

```bash
brainbase config set apiKey bb_live_...
brainbase config set baseUrl https://brainbase.belweave.ai
brainbase config set brainId <uuid>
brainbase config get apiKey
brainbase config list
brainbase config unset brainId
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override API key |
| `--brain-id <id>` | Override brain ID |
| `--json` | Output raw JSON |
| `--quiet` | Suppress non-error output |
| `--verbose` | Enable verbose logging |

## Override per command

```bash
brainbase health --api-key bb_live_other --brain-id other-brain
```

Priority: `--api-key` flag > `BRAINBASE_API_KEY` env var > `~/.brainbase/config.json`

## License

MIT
