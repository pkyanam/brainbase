/**
 * Action execution system for Brainbase triggers.
 * Handles: notifications, todo creation, task delegation, webhooks.
 */

import { TriggerAction } from "./triggers";
import { query } from "./supabase/client";

export interface ActionContext {
  brainId: string;
  pageSlug: string;
  pageTitle: string;
  pageType: string | null;
  content: string;
  matches: Record<string, unknown>;
}

/**
 * Render a message template with context variables.
 */
function renderTemplate(template: string, ctx: ActionContext): string {
  let result = template
    .replace(/\{slug\}/g, ctx.pageSlug)
    .replace(/\{title\}/g, ctx.pageTitle)
    .replace(/\{type\}/g, ctx.pageType || "page")
    .replace(/\{summary\}/g, ctx.content.slice(0, 500));

  // Render {matches.X} placeholders
  const matchKeys = Object.keys(ctx.matches);
  for (const key of matchKeys) {
    const val = ctx.matches[key];
    const strVal = Array.isArray(val) ? val.join(", ") : String(val);
    result = result.replace(new RegExp(`{matches.${key}}`, "g"), strVal);
  }

  return result;
}

/**
 * Execute a single trigger action.
 */
export async function executeAction(
  action: TriggerAction,
  ctx: ActionContext
): Promise<{ success: boolean; result: string }> {
  const message = action.message
    ? renderTemplate(action.message, ctx)
    : `Trigger fired on ${ctx.pageSlug}`;

  switch (action.type) {
    case "notify":
      return executeNotify(action.target, message);

    case "create_todo":
      return executeTodo(ctx.brainId, ctx.pageSlug, message);

    case "delegate_fix":
      return executeDelegate(ctx, action.instruction || message);

    case "webhook":
      return executeWebhook(action.target, ctx, message);

    default:
      return { success: false, result: `Unknown action type: ${action.type}` };
  }
}

/**
 * Send a notification. Currently supports Telegram via send_message tool
 * (called from the agent layer; here we just log for now).
 * In production, this would call the notification service.
 */
async function executeNotify(
  target: string | undefined,
  message: string
): Promise<{ success: boolean; result: string }> {
  // Log the notification for the agent to pick up
  console.log(`[brainbase:notify] Target: ${target || "default"}\n${message}`);

  // Store in notifications table for polling
  await query(
    `CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID,
      channel TEXT,
      message TEXT NOT NULL,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  );

  await query(
    `INSERT INTO notifications (brain_id, channel, message)
     VALUES ($1, $2, $3)`,
    [null, target || "default", message]
  );

  return { success: true, result: "Notification queued" };
}

/**
 * Create a todo item in the brain's todo table.
 */
async function executeTodo(
  brainId: string,
  pageSlug: string,
  message: string
): Promise<{ success: boolean; result: string }> {
  await query(
    `CREATE TABLE IF NOT EXISTS brain_todos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL,
      page_slug TEXT,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'high',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  );

  const row = await query<{ id: string }>(
    `INSERT INTO brain_todos (brain_id, page_slug, content, priority)
     VALUES ($1, $2, $3, 'high')
     RETURNING id`,
    [brainId, pageSlug, message]
  );

  return { success: true, result: `Todo created: ${row.rows[0]?.id}` };
}

/**
 * Delegate a fix task. Logs the instruction for a subagent to pick up.
 * In the agent architecture, the cron or signal detector would poll
 * for delegated tasks and spawn subagents.
 */
async function executeDelegate(
  ctx: ActionContext,
  instruction: string
): Promise<{ success: boolean; result: string }> {
  await query(
    `CREATE TABLE IF NOT EXISTS delegated_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL,
      page_slug TEXT NOT NULL,
      instruction TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      context JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  );

  const row = await query<{ id: string }>(
    `INSERT INTO delegated_tasks (brain_id, page_slug, instruction, context)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      ctx.brainId,
      ctx.pageSlug,
      instruction,
      JSON.stringify({
        matches: ctx.matches,
        contentPreview: ctx.content.slice(0, 2000),
      }),
    ]
  );

  const taskId = row.rows[0]?.id;
  console.log(`[brainbase:delegate] Task ${taskId} created for ${ctx.pageSlug}`);

  return { success: true, result: `Delegated task ${taskId}: ${instruction.slice(0, 100)}...` };
}

/**
 * Send a webhook POST request.
 */
async function executeWebhook(
  url: string | undefined,
  ctx: ActionContext,
  message: string
): Promise<{ success: boolean; result: string }> {
  if (!url) {
    return { success: false, result: "Webhook URL missing" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brainId: ctx.brainId,
        pageSlug: ctx.pageSlug,
        pageTitle: ctx.pageTitle,
        message,
        matches: ctx.matches,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      return { success: false, result: `Webhook failed: ${res.status} ${res.statusText}` };
    }

    return { success: true, result: `Webhook sent to ${url}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, result: `Webhook error: ${msg}` };
  }
}

/**
 * Run all actions for a set of fired triggers.
 */
export async function runActions(
  fired: { ruleName: string; actions: TriggerAction[]; matches: Record<string, unknown> }[],
  ctx: ActionContext
): Promise<{ ruleName: string; actionResults: { type: string; success: boolean; result: string }[] }[]> {
  const results: { ruleName: string; actionResults: { type: string; success: boolean; result: string }[] }[] = [];

  for (const fire of fired) {
    const actionResults: { type: string; success: boolean; result: string }[] = [];

    for (const action of fire.actions) {
      const result = await executeAction(action, ctx);
      actionResults.push({ type: action.type, ...result });
    }

    results.push({ ruleName: fire.ruleName, actionResults });
  }

  return results;
}
