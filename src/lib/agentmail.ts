/**
 * AgentMail API client for Brainbase.
 * Handles inbox management, message fetching, and webhook registration.
 * Base URL: https://api.agentmail.to/v0
 */

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY || "";
const AGENTMAIL_BASE_URL = "https://api.agentmail.to/v0";

interface AgentMailInbox {
  inbox_id: string;
  email: string;
  display_name: string;
  organization_id: string;
  created_at: string;
}

interface AgentMailMessage {
  message_id: string;
  inbox_id: string;
  thread_id: string;
  from_: string[];
  to: string[];
  subject: string;
  text: string;
  html?: string;
  preview: string;
  timestamp: string;
  labels: string[];
  attachments?: Array<{
    attachment_id: string;
    filename: string;
    content_type: string;
    size: number;
  }>;
}

interface AgentMailWebhook {
  webhook_id: string;
  url: string;
  event_types: string[];
  enabled: boolean;
}

async function amFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!AGENTMAIL_API_KEY) {
    throw new Error("AGENTMAIL_API_KEY not configured");
  }

  const res = await fetch(`${AGENTMAIL_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${AGENTMAIL_API_KEY}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AgentMail API error ${res.status}: ${err}`);
  }

  return res.json();
}

// ── Inboxes ──

export async function listInboxes(): Promise<AgentMailInbox[]> {
  const data = await amFetch<{ count: number; inboxes: AgentMailInbox[] }>("/inboxes");
  return data.inboxes;
}

export async function getInbox(inboxId: string): Promise<AgentMailInbox> {
  return amFetch<AgentMailInbox>(`/inboxes/${inboxId}`);
}

export async function createInbox(opts?: {
  displayName?: string;
  username?: string;
  domain?: string;
  clientId?: string;
}): Promise<AgentMailInbox> {
  return amFetch<AgentMailInbox>("/inboxes", {
    method: "POST",
    body: JSON.stringify({
      display_name: opts?.displayName,
      username: opts?.username,
      domain: opts?.domain,
      client_id: opts?.clientId,
    }),
  });
}

// ── Messages ──

export async function listMessages(inboxId: string): Promise<AgentMailMessage[]> {
  const data = await amFetch<{ count: number; messages: AgentMailMessage[] }>(
    `/inboxes/${inboxId}/messages`
  );
  return data.messages;
}

export async function getMessage(inboxId: string, messageId: string): Promise<AgentMailMessage> {
  return amFetch<AgentMailMessage>(`/inboxes/${inboxId}/messages/${messageId}`);
}

// ── Webhooks ──

export async function listWebhooks(): Promise<AgentMailWebhook[]> {
  const data = await amFetch<{ count: number; webhooks: AgentMailWebhook[] }>("/webhooks");
  return data.webhooks;
}

export async function createWebhook(opts: {
  url: string;
  eventTypes?: string[];
  clientId?: string;
}): Promise<AgentMailWebhook> {
  return amFetch<AgentMailWebhook>("/webhooks", {
    method: "POST",
    body: JSON.stringify({
      url: opts.url,
      event_types: opts.eventTypes || ["message.received"],
      client_id: opts.clientId,
    }),
  });
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  await amFetch(`/webhooks/${webhookId}`, { method: "DELETE" });
}

// ── Content extraction for brain ingestion ──

export interface EmailBrainPayload {
  slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter: Record<string, unknown>;
}

/**
 * Convert an AgentMail message to a Brainbase page payload.
 */
export function messageToBrainPayload(msg: AgentMailMessage): EmailBrainPayload {
  const date = new Date(msg.timestamp).toISOString().split("T")[0];
  const slug = `email-${msg.inbox_id}-${msg.message_id.replace(/[<@>]/g, "").replace(/\./g, "-")}`;

  const content = [
    `## ${msg.subject}`,
    ``,
    `**From:** ${msg.from_.join(", ")}`,
    `**To:** ${msg.to.join(", ")}`,
    `**Date:** ${msg.timestamp}`,
    `**Inbox:** ${msg.inbox_id}`,
    msg.labels.length > 0 ? `**Labels:** ${msg.labels.join(", ")}` : "",
    ``,
    `---`,
    ``,
    msg.text || msg.preview || "(No text content)",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    slug,
    title: msg.subject,
    type: "email",
    content,
    frontmatter: {
      from: msg.from_,
      to: msg.to,
      subject: msg.subject,
      date: msg.timestamp,
      inbox_id: msg.inbox_id,
      thread_id: msg.thread_id,
      message_id: msg.message_id,
      labels: msg.labels,
      has_attachments: (msg.attachments?.length || 0) > 0,
    },
  };
}
