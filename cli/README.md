# Brainbase CLI

> The official command-line interface for [Brainbase](https://brainbase.belweave.ai) — query and manage your knowledge graph from the terminal.

[![npm version](https://img.shields.io/npm/v/brainbase-cli.svg)](https://www.npmjs.com/package/brainbase-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Install

```bash
npm install -g brainbase-cli
```

Requires **Node.js 18+** (uses native `fetch`).

## Quickstart

```bash
# Set your endpoint and API key
export BRAINBASE_URL="https://brainbase.belweave.ai"
export BRAINBASE_API_KEY="bb_live_..."

# Search your brain
brainbase search "garry tan"

# Ask a natural language question
brainbase query "who do I know at YC?"

# Check brain health
brainbase health

# Get a specific page
brainbase page people/garry-tan
```

## Configuration

The CLI reads from environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BRAINBASE_URL` | No | `http://localhost:5174` | Brainbase API endpoint |
| `BRAINBASE_API_KEY` | Yes* | — | Your API key |
| `BRAINBASE_BRAIN_ID` | No | — | Default brain ID (multi-tenant) |
| `BRAINBASE_TIMEOUT_MS` | No | `30000` | Request timeout in ms |

\* Required for remote URLs. Not needed for localhost.

**Multi-brain support:** Override the default brain per-command:

```bash
brainbase health --brain-id <uuid>
```

## Commands

### Read Operations

| Command | Description |
|---------|-------------|
| `brainbase search <query>` | Full-text search |
| `brainbase query <question>` | Natural language query |
| `brainbase health` | Brain health dashboard |
| `brainbase stats` | Detailed statistics |
| `brainbase page <slug>` | Get a page by slug |
| `brainbase links <slug>` | Show page links |
| `brainbase timeline <slug>` | Show timeline entries |
| `brainbase list` | List all pages |
| `brainbase traverse <slug>` | Traverse the knowledge graph |
| `brainbase graph` | Dump full graph as JSON |

### Write Operations

| Command | Description |
|---------|-------------|
| `brainbase put-page <slug> <title>` | Create or update a page |
| `brainbase delete-page <slug>` | Delete a page |
| `brainbase add-link <from> <to>` | Create a link |
| `brainbase remove-link <from> <to>` | Remove a link |
| `brainbase add-timeline <slug> <date> <summary>` | Add timeline entry |

### Global Flags

| Flag | Description |
|------|-------------|
| `--brain-id <id>` | Target a specific brain |
| `--json` | Output raw JSON |
| `--quiet` | Suppress non-error output |
| `--verbose` | Enable verbose logging |
| `-h, --help` | Show help |
| `-V, --version` | Show version |

## Examples

```bash
# Search with limit
brainbase search "YC founders" --limit 10

# List only people
brainbase list --type person --limit 20

# Traverse graph 3 levels deep
brainbase traverse people/preetham-kyanam --depth 3 --direction both

# Create a new page
brainbase put-page ideas/new-product "My Product Idea" \
  --type idea \
  --content "This is a markdown description..."

# Link two pages
brainbase add-link people/preetham-kyanam companies/nous-research \
  --type works_at

# Add a timeline entry
brainbase add-timeline people/garry-tan 2024-01-15 "Became YC CEO" \
  --detail "Announced on Twitter" \
  --source "https://twitter.com/garrytan/..."

# Get everything as JSON for piping
brainbase graph --json | jq '.nodes | length'
brainbase search "AI" --json | jq '.[0].title'
```

## Security

- **API keys are never logged or displayed.** If an error leaks a key, it is redacted before output.
- The CLI requires an API key for all remote endpoints. Localhost is exempt for development.
- No secrets are stored on disk — everything is read from environment variables.

## Development

```bash
cd cli
npm install
npm run dev -- search "test"      # run without building
npm test                          # run tests
npm run test:watch                # watch mode
npm run build                     # compile TypeScript
npm run typecheck                 # check types
```

## License

MIT © [Preetham Kyanam](https://github.com/pkyanam)
