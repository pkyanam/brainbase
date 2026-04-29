/**
 * Trigger/rules engine for Brainbase.
 * Configurable rules that fire when pages match conditions.
 * Example: "if page contains 'CVE' and links to project → notify"
 */

import { query, queryOne, queryMany } from "./supabase/client";

export interface TriggerCondition {
  /** Match page type (e.g., 'security', 'email', 'project') */
  pageType?: string;
  /** Content must contain this substring (case-insensitive) */
  contentContains?: string[];
  /** Page must have links to pages matching these slugs (or any if empty) */
  hasLinksTo?: string[];
  /** Minimum semantic similarity to trigger (0-1) */
  minSimilarity?: number;
  /** Slug must match this regex pattern */
  slugPattern?: string;
}

export interface TriggerAction {
  type: "notify" | "create_todo" | "delegate_fix" | "webhook";
  /** Telegram chat ID, webhook URL, etc. */
  target?: string;
  /** Message template with {slug}, {title}, {summary} placeholders */
  message?: string;
  /** For delegate_fix: what to tell the subagent */
  instruction?: string;
}

export interface TriggerRule {
  id?: string;
  brainId: string;
  name: string;
  description?: string;
  conditions: TriggerCondition;
  actions: TriggerAction[];
  enabled: boolean;
  cooldownMinutes?: number; // Don't fire same rule on same page within N minutes
}

interface TriggerFire {
  ruleId: string;
  pageSlug: string;
  brainId: string;
  matchedAt: Date;
}

/**
 * Ensure triggers schema exists.
 */
export async function ensureTriggersSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS trigger_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      conditions JSONB NOT NULL DEFAULT '{}',
      actions JSONB NOT NULL DEFAULT '[]',
      enabled BOOLEAN NOT NULL DEFAULT true,
      cooldown_minutes INT DEFAULT 60,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trigger_fires (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL,
      rule_id UUID NOT NULL REFERENCES trigger_rules(id) ON DELETE CASCADE,
      page_slug TEXT NOT NULL,
      matched_conditions JSONB,
      actions_taken JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_trigger_fires_rule_page
    ON trigger_fires(brain_id, rule_id, page_slug, created_at)
  `);
}

/**
 * Create or update a trigger rule.
 */
export async function upsertTriggerRule(rule: TriggerRule): Promise<string> {
  await ensureTriggersSchema();

  const existing = rule.id
    ? await queryOne<{ id: string }>(
        `SELECT id FROM trigger_rules WHERE id = $1 AND brain_id = $2`,
        [rule.id, rule.brainId]
      )
    : null;

  if (existing) {
    await query(
      `UPDATE trigger_rules
       SET name = $1, description = $2, conditions = $3, actions = $4,
           enabled = $5, cooldown_minutes = $6, updated_at = NOW()
       WHERE id = $7`,
      [
        rule.name,
        rule.description || null,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        rule.enabled,
        rule.cooldownMinutes || 60,
        existing.id,
      ]
    );
    return existing.id;
  } else {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO trigger_rules (brain_id, name, description, conditions, actions, enabled, cooldown_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        rule.brainId,
        rule.name,
        rule.description || null,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        rule.enabled,
        rule.cooldownMinutes || 60,
      ]
    );
    return row!.id;
  }
}

/**
 * Get all active trigger rules for a brain.
 */
export async function getActiveRules(brainId: string): Promise<TriggerRule[]> {
  await ensureTriggersSchema();
  const rows = await queryMany<{
    id: string;
    brain_id: string;
    name: string;
    description: string | null;
    conditions: string;
    actions: string;
    enabled: boolean;
    cooldown_minutes: number;
  }>(
    `SELECT id, brain_id, name, description, conditions::text, actions::text, enabled, cooldown_minutes
     FROM trigger_rules
     WHERE brain_id = $1 AND enabled = true`,
    [brainId]
  );

  return rows.map(r => ({
    id: r.id,
    brainId: r.brain_id,
    name: r.name,
    description: r.description || undefined,
    conditions: JSON.parse(r.conditions),
    actions: JSON.parse(r.actions),
    enabled: r.enabled,
    cooldownMinutes: r.cooldown_minutes,
  }));
}

/**
 * Check if a rule has fired for a page within cooldown period.
 */
async function isOnCooldown(
  brainId: string,
  ruleId: string,
  pageSlug: string,
  cooldownMinutes: number
): Promise<boolean> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM trigger_fires
     WHERE brain_id = $1 AND rule_id = $2 AND page_slug = $3
       AND created_at > NOW() - INTERVAL '${cooldownMinutes} minutes'`,
    [brainId, ruleId, pageSlug]
  );
  return parseInt(row?.count || "0") > 0;
}

/**
 * Evaluate if a page matches a trigger's conditions.
 */
export async function evaluateConditions(
  brainId: string,
  pageSlug: string,
  pageTitle: string,
  pageType: string | null,
  content: string,
  conditions: TriggerCondition
): Promise<{ matched: boolean; matches: Record<string, unknown> }> {
  const matches: Record<string, unknown> = {};

  // Page type check
  if (conditions.pageType && pageType !== conditions.pageType) {
    return { matched: false, matches: {} };
  }
  if (conditions.pageType) matches.pageType = pageType;

  // Content contains check
  if (conditions.contentContains && conditions.contentContains.length > 0) {
    const contentLower = content.toLowerCase();
    const found = conditions.contentContains.filter(kw => contentLower.includes(kw.toLowerCase()));
    if (found.length === 0) return { matched: false, matches: {} };
    matches.keywordsFound = found;
  }

  // Slug pattern check
  if (conditions.slugPattern) {
    const regex = new RegExp(conditions.slugPattern, "i");
    if (!regex.test(pageSlug)) return { matched: false, matches: {} };
    matches.slugMatch = true;
  }

  // Links to specific pages check
  if (conditions.hasLinksTo && conditions.hasLinksTo.length > 0) {
    const linkRows = await queryMany<{ to_slug: string }>(
      `SELECT to_slug FROM links WHERE brain_id = $1 AND from_slug = $2`,
      [brainId, pageSlug]
    );
    const linkedSlugs = linkRows.map(r => r.to_slug);
    const required = conditions.hasLinksTo;
    const hasAll = required.every(s => linkedSlugs.includes(s));
    if (!hasAll) return { matched: false, matches: {} };
    matches.linkedTo = linkedSlugs.filter(s => required.includes(s));
  }

  return { matched: true, matches };
}

/**
 * Run all trigger rules against a page. Returns fired rules + actions.
 */
export async function runTriggers(
  brainId: string,
  pageSlug: string,
  pageTitle: string,
  pageType: string | null,
  content: string
): Promise<{ ruleName: string; actions: TriggerAction[]; matches: Record<string, unknown> }[]> {
  const rules = await getActiveRules(brainId);
  const fired: { ruleName: string; actions: TriggerAction[]; matches: Record<string, unknown> }[] = [];

  for (const rule of rules) {
    // Skip if on cooldown
    if (await isOnCooldown(brainId, rule.id!, pageSlug, rule.cooldownMinutes || 60)) {
      continue;
    }

    const { matched, matches } = await evaluateConditions(
      brainId, pageSlug, pageTitle, pageType, content, rule.conditions
    );

    if (matched) {
      // Record the fire
      await query(
        `INSERT INTO trigger_fires (brain_id, rule_id, page_slug, matched_conditions, actions_taken)
         VALUES ($1, $2, $3, $4, $5)`,
        [brainId, rule.id!, pageSlug, JSON.stringify(matches), JSON.stringify(rule.actions)]
      );

      fired.push({ ruleName: rule.name, actions: rule.actions, matches });
      console.log(`[brainbase] Trigger fired: "${rule.name}" on ${pageSlug}`);
    }
  }

  return fired;
}
