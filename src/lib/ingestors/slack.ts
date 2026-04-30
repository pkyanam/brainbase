/**
 * Slack Ingestor — pulls messages, threads, and decisions from Slack
 * and transforms them into Brainbase pages.
 *
 * Handles:
 * - Channel messages (public channels)
 * - Thread replies (collapsed into parent context)
 * - Decision keywords ("decided", "agreed", "approved", "LGTM")
 * - People mentions → links to person pages
 * - Channel topics → concept pages
 */

import { Ingestor, RawDocument, BrainPageDraft, registerIngestor } from "./types";

interface SlackConfig {
  botToken: string;
  teamId: string;
  channels?: string[]; // specific channels, or all public
}

export class SlackIngestor implements Ingestor {
  readonly name = "slack";
  readonly description = "Ingest Slack messages, threads, and decisions";
  readonly requiredConfig = ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"];

  private config?: SlackConfig;
  private baseUrl = "https://slack.com/api";

  async authenticate(config: Record<string, string>): Promise<void> {
    this.config = {
      botToken: config.SLACK_BOT_TOKEN,
      teamId: config.SLACK_TEAM_ID,
      channels: config.SLACK_CHANNELS
        ? config.SLACK_CHANNELS.split(",").map((c) => c.trim())
        : undefined,
    };

    // Validate token with auth.test
    const res = await fetch(`${this.baseUrl}/auth.test`, {
      headers: { Authorization: `Bearer ${this.config.botToken}` },
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Slack auth failed: ${data.error}`);
    }
  }

  async fetch(cursor: string | null): Promise<{
    documents: RawDocument[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    if (!this.config) throw new Error("Not authenticated");

    const channels = this.config.channels ?? (await this.listPublicChannels());
    const since = cursor ? new Date(cursor) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const docs: RawDocument[] = [];

    for (const channelId of channels) {
      const messages = await this.fetchMessages(channelId, since);
      for (const msg of messages) {
        docs.push({
          id: `${channelId}/${msg.ts}`,
          source: "slack",
          createdAt: new Date(parseFloat(msg.ts) * 1000),
          updatedAt: new Date(parseFloat(msg.ts) * 1000),
          content: msg.text,
          metadata: {
            channelId,
            user: msg.user,
            threadTs: msg.thread_ts,
            replyCount: msg.reply_count ?? 0,
            reactions: msg.reactions ?? [],
            channelName: msg.channel_name,
          },
        });
      }
    }

    return {
      documents: docs,
      nextCursor: new Date().toISOString(),
      hasMore: false, // Slack API is time-windowed; caller manages re-runs
    };
  }

  async transform(doc: RawDocument): Promise<BrainPageDraft[]> {
    const m = doc.metadata;
    const channelName = (m.channelName as string) ?? "unknown";
    const user = (m.user as string) ?? "unknown";
    const isDecision = /\b(decided|agreed|approved|LGTM|conclusion|resolved)\b/i.test(doc.content);
    const hasThread = (m.replyCount as number) > 0;

    const drafts: BrainPageDraft[] = [];

    // Always create a message page
    drafts.push({
      slug: `slack/${channelName}/${doc.id.replace(/\//g, "-")}`,
      title: `Slack: ${channelName} — ${doc.content.slice(0, 60)}${doc.content.length > 60 ? "..." : ""}`,
      type: isDecision ? "decision" : "message",
      content: this.formatMessage(doc),
      frontmatter: {
        source: "slack",
        channel: channelName,
        author: user,
        date: doc.createdAt.toISOString().split("T")[0],
        thread_replies: m.replyCount,
        reactions: m.reactions,
      },
      links: this.extractMentions(doc.content),
      timeline: isDecision
        ? [
            {
              date: doc.createdAt.toISOString().split("T")[0],
              summary: `Decision in #${channelName}`,
              detail: doc.content.slice(0, 200),
            },
          ]
        : undefined,
      writtenBy: "slack-ingestor",
      provenance: { system: "slack", id: doc.id },
      confidence: hasThread ? 0.85 : 0.7, // threaded discussions = higher confidence
    });

    // If it's a decision, also create/update a "decisions" concept page
    if (isDecision) {
      const topic = this.extractTopic(doc.content);
      if (topic) {
        drafts.push({
          slug: `decisions/${topic.toLowerCase().replace(/\s+/g, "-")}`,
          title: `Decision: ${topic}`,
          type: "decision",
          content: `## Decision: ${topic}\n\n**Made in:** #${channelName}\n**Date:** ${doc.createdAt.toISOString().split("T")[0]}\n**By:** ${user}\n\n${doc.content}`,
          frontmatter: {
            source: "slack",
            topic,
            channel: channelName,
            date: doc.createdAt.toISOString().split("T")[0],
          },
          links: [{ to: `slack/${channelName}/${doc.id.replace(/\//g, "-")}`, type: "source" }],
          writtenBy: "slack-ingestor",
          provenance: { system: "slack", id: doc.id },
          confidence: 0.9,
        });
      }
    }

    return drafts;
  }

  // ── Private helpers ─────────────────────────────────────────────

  private async listPublicChannels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/conversations.list?types=public_channel&exclude_archived=true`, {
      headers: { Authorization: `Bearer ${this.config!.botToken}` },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack channels.list failed: ${data.error}`);
    return data.channels.map((c: any) => c.id);
  }

  private async fetchMessages(channelId: string, since: Date): Promise<any[]> {
    const oldest = String(since.getTime() / 1000);
    const res = await fetch(
      `${this.baseUrl}/conversations.history?channel=${channelId}&oldest=${oldest}&limit=200`,
      { headers: { Authorization: `Bearer ${this.config!.botToken}` } }
    );
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack history failed: ${data.error}`);

    // Enrich with channel name
    const channelRes = await fetch(`${this.baseUrl}/conversations.info?channel=${channelId}`, {
      headers: { Authorization: `Bearer ${this.config!.botToken}` },
    });
    const channelData = await channelRes.json();
    const channelName = channelData.ok ? channelData.channel.name : channelId;

    return (data.messages ?? []).map((m: any) => ({ ...m, channel_name: channelName }));
  }

  private formatMessage(doc: RawDocument): string {
    const m = doc.metadata;
    const lines = [
      `> **Author:** ${m.user}`,
      `> **Channel:** #${m.channelName}`,
      `> **Date:** ${doc.createdAt.toISOString()}`,
      `> **Replies:** ${m.replyCount ?? 0}`,
      "",
      doc.content,
    ];
    return lines.join("\n");
  }

  private extractMentions(text: string): { to: string; type: string }[] {
    const mentions: { to: string; type: string }[] = [];
    const userMatches = text.match(/<@(\w+)>/g);
    if (userMatches) {
      for (const match of userMatches) {
        const userId = match.replace(/[<@>]/g, "");
        mentions.push({ to: `people/slack-${userId}`, type: "mentioned" });
      }
    }
    const channelMatches = text.match(/<#(\w+)\|?(\w*)>/g);
    if (channelMatches) {
      for (const match of channelMatches) {
        const channelName = match.split("|")[1]?.replace(">", "") ?? "unknown";
        mentions.push({ to: `channels/${channelName}`, type: "referenced" });
      }
    }
    return mentions;
  }

  private extractTopic(text: string): string | null {
    // Simple heuristic: first sentence after "decided" or "agreed to"
    const match = text.match(/(?:decided|agreed to|concluded that|resolved)\s+(.+?)[.!?]/i);
    return match ? match[1].trim().slice(0, 80) : null;
  }
}

registerIngestor("slack", SlackIngestor);
