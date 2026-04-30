# Brainbase Security Audit — April 30, 2026

## Executive Summary

**Critical finding: Zero RLS policies across the entire database.** Authorization exists only at the Next.js API layer (Clerk middleware). Any direct database access — leaked service key, backup script, SQL injection, future feature — bypasses all tenant isolation completely.

**Risk level: HIGH** for a multi-tenant SaaS.

---

## Audit Scope

All tables in the `public` schema across both Brainbase app tables and GBrain core tables.

---

## Findings

### 1. ❌ NO RLS ON ANY TABLE (Critical)

Every table in the database has Row Level Security **disabled**. This means:
- Any connection with DB credentials can `SELECT * FROM brains` and see every customer's brain metadata
- Any connection can `SELECT * FROM brain_invites` and harvest invitation tokens
- Any connection can `SELECT * FROM api_keys` and see key hashes (enables offline brute force)
- Any connection can read/write any user's pages, links, embeddings

**Affected tables:**
| Table | Tenant Column | Sensitive Data |
|-------|--------------|----------------|
| `brains` | `owner_user_id` | Names, slugs, **Supabase keys in plain text** |
| `api_keys` | `brain_id`, `user_id` | Key prefixes, key hashes |
| `brain_members` | `brain_id`, `user_id` | User IDs, roles |
| `brain_invites` | `brain_id` | Emails, **invitation tokens in plain text** |
| `page_versions` | `brain_id` | Full page content snapshots |
| `activities` | `brain_id` | Action logs, metadata JSONB |
| `applications` | N/A | Names, emails, companies, messages |
| `pages` | `brain_id` | Full knowledge graph content |
| `links` | `brain_id` | Relationship graph |
| `content_chunks` | `brain_id` | Embeddings of private data |
| `timeline_entries` | `brain_id` | Timeline data |
| `tags` | (via pages) | Tag associations |
| `trigger_rules` | `brain_id` | Rule definitions |
| `trigger_fires` | `brain_id` | Trigger execution logs |
| `notifications` | `brain_id` | Notification content |
| `brain_todos` | `brain_id` | Todo items |
| `delegated_tasks` | `brain_id` | Delegated task content |
| `usage_logs` | `brain_id` | Usage metrics |

### 2. ❌ PLAIN-TEXT SECRETS IN `brains` TABLE (Critical)

```sql
-- Column: brains.supabase_key (TEXT)
-- Stores the Supabase service role key for each user's brain
-- If DB is compromised, attacker gets Supabase admin access to ALL customer brains
```

**Recommendation:** Encrypt `supabase_key` at rest using AES-256-GCM with a master key stored in Vercel env (not in DB).

### 3. ❌ PLAIN-TEXT INVITATION TOKENS IN `brain_invites` (High)

```sql
-- Column: brain_invites.token (TEXT, UNIQUE)
-- Anyone with DB access can accept invites or forge new ones
```

**Recommendation:** Hash tokens with bcrypt or at least SHA-256 before storage. Store hash, verify on accept.

### 4. ⚠️ Authorization Only at API Layer (Medium-High)

The `auth-guard.ts` enforces `requireBrainAccess()` at the Next.js API level. This is good but insufficient:
- SQL injection in any API route bypasses it
- Backup scripts, analytics queries, MCP direct connections bypass it
- A single compromised API endpoint exposes everything

**Recommendation:** Add RLS as defense-in-depth. API auth + RLS = two gates, not one.

### 5. ⚠️ `api_keys` Table Queryable Without Auth (Medium)

Even though `key_hash` is hashed, the table is fully readable. An attacker can:
- See all active API keys per brain
- See key prefixes (enables targeted brute force)
- See `last_used_at` (enables usage pattern analysis)

**Recommendation:** RLS on `api_keys` restricting to `brain_id` owner/members.

### 6. ⚠️ `applications` Table Has No Tenant Scoping (Low)

Design partner applications are globally readable. Not critical but leaks interested customer data.

---

## Root Cause

The `ARCHITECTURE.md` (written early in the project) explicitly recommends RLS as the multi-tenant strategy for v0.3 MVP:

```sql
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own pages"
  ON pages FOR ALL
  USING (user_id = auth.uid());
```

However, `src/lib/db-setup.ts` (the actual schema bootstrap) **never implemented RLS**. The code went from "namespace prefix" prototype directly to "Clerk middleware at API layer" without adding the database guardrails.

---

## Remediation Plan

### Phase 1: Enable RLS on All Tables (Immediate)

Since Brainbase connects via the `postgres` role (table owner), RLS does NOT affect the app. Table owners bypass RLS by default. RLS only restricts non-owner roles (e.g., Supabase anon key, direct client connections).

However, we should also create policies for future-proofing if the app ever uses Supabase client libraries with RLS.

### Phase 2: Encrypt Sensitive Fields (This Week)

- `brains.supabase_key` → AES-256-GCM encryption
- `brain_invites.token` → bcrypt/SHA-256 hash

### Phase 3: Add RLS Policies (This Week)

Create policies that match the app's auth model:
- `brains`: Owner sees own, members see member brains
- `pages`, `links`, `content_chunks`, `timeline_entries`: Filter by `brain_id` where user is owner/member
- `api_keys`: Only brain owner
- `brain_invites`: Only brain owner
- `brain_members`: Only brain owner
- `activities`: Brain owner/members

---

## Scripts

See `scripts/security-migration.sql` for the RLS enablement script.
See `scripts/encrypt-secrets.ts` for the secret encryption migration.
