# Brainbase — Claude Code Instructions

See [AGENTS.md](./AGENTS.md) for full project documentation and agent instructions.

## MCP Connection (Claude Code)

```bash
claude mcp add --transport http brainbase https://brainbase.belweave.ai/api/mcp \
  --header "Authorization: Bearer bb_live_YOUR_KEY"
```

Or drop into `.claude.json`:

```json
{
  "mcpServers": {
    "brainbase": {
      "type": "http",
      "url": "https://brainbase.belweave.ai/api/mcp",
      "headers": {
        "Authorization": "Bearer bb_live_YOUR_KEY"
      }
    }
  }
}
```

## Claude-Specific

- Use `search_files` not `grep` for code search
- Use `read_file` not `cat` for reading files  
- Use `patch` not `sed` for targeted edits
- The codebase uses Next.js 16 App Router — prefer server components, avoid `use client` unless necessary
- Supabase queries go through `src/lib/supabase/client.ts` — never use raw `pg` module
- TypeScript strict mode is not enabled — be defensive about null checks
- Run `npx tsc --noEmit` before committing to catch type errors
- The dev server runs on port 5174: `npm run dev`

## Quick Commands

```bash
# Dev server
npm run dev

# Type check
npx tsc --noEmit

# Deploy (auto-deploys on push to main)
git push origin main
```
