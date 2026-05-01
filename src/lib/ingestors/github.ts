/**
 * GitHub Ingestor — pulls repos, issues, and PRs from GitHub
 * and transforms them into Brainbase pages.
 *
 * Handles:
 * - Repositories (as project pages)
 * - Issues (as issue pages with timeline)
 * - Pull Requests (as pull_request pages with timeline)
 * - Authors → links to person pages
 * - Labels → links to concept pages
 */

import { Ingestor, RawDocument, BrainPageDraft, registerIngestor } from "./types";

interface GitHubConfig {
  token: string;
  owner?: string;
  repos?: string[]; // ["owner/repo", ...] or fetch all for authenticated user
}

export class GitHubIngestor implements Ingestor {
  readonly name = "github";
  readonly description = "Ingest GitHub repos, issues, and pull requests";
  readonly requiredConfig = ["GITHUB_TOKEN"];

  private config?: GitHubConfig;
  private baseUrl = "https://api.github.com";

  async authenticate(config: Record<string, string>): Promise<void> {
    this.config = {
      token: config.GITHUB_TOKEN,
      owner: config.GITHUB_OWNER,
      repos: config.GITHUB_REPOS
        ? config.GITHUB_REPOS.split(",").map((r) => r.trim())
        : undefined,
    };

    // Validate token
    const res = await fetch(`${this.baseUrl}/user`, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(`GitHub auth failed: ${data.message || res.statusText}`);
    }
  }

  async fetch(cursor: string | null): Promise<{
    documents: RawDocument[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    if (!this.config) throw new Error("Not authenticated");

    const docs: RawDocument[] = [];
    const repos = this.config.repos ?? (await this.listRepos());

    for (const repoFull of repos) {
      const [owner, repo] = repoFull.split("/");
      if (!owner || !repo) continue;

      // Fetch issues
      const issues = await this.fetchIssues(owner, repo);
      for (const issue of issues) {
        docs.push({
          id: `issue/${owner}/${repo}/${issue.number}`,
          source: "github",
          createdAt: new Date(issue.created_at),
          updatedAt: new Date(issue.updated_at),
          content: issue.body || issue.title,
          metadata: {
            owner,
            repo,
            number: issue.number,
            title: issue.title,
            state: issue.state,
            author: issue.user?.login,
            labels: issue.labels?.map((l: any) => (typeof l === "string" ? l : l.name)),
            url: issue.html_url,
            kind: "issue",
            isPullRequest: !!issue.pull_request,
          },
        });
      }

      // Fetch PRs
      const prs = await this.fetchPRs(owner, repo);
      for (const pr of prs) {
        docs.push({
          id: `pr/${owner}/${repo}/${pr.number}`,
          source: "github",
          createdAt: new Date(pr.created_at),
          updatedAt: new Date(pr.updated_at),
          content: pr.body || pr.title,
          metadata: {
            owner,
            repo,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            merged: pr.merged_at ? true : false,
            author: pr.user?.login,
            labels: pr.labels?.map((l: any) => (typeof l === "string" ? l : l.name)),
            url: pr.html_url,
            kind: "pr",
          },
        });
      }

      // Repo itself as a document
      const repoInfo = await this.fetchRepo(owner, repo);
      if (repoInfo) {
        docs.push({
          id: `repo/${owner}/${repo}`,
          source: "github",
          createdAt: new Date(repoInfo.created_at),
          updatedAt: new Date(repoInfo.updated_at),
          content: repoInfo.description || "",
          metadata: {
            owner,
            repo,
            title: repoInfo.full_name,
            description: repoInfo.description,
            language: repoInfo.language,
            stars: repoInfo.stargazers_count,
            url: repoInfo.html_url,
            kind: "repo",
          },
        });
      }
    }

    return {
      documents: docs,
      nextCursor: new Date().toISOString(),
      hasMore: false,
    };
  }

  async transform(doc: RawDocument): Promise<BrainPageDraft[]> {
    const m = doc.metadata;
    const kind = m.kind as string;
    const owner = m.owner as string;
    const repo = m.repo as string;
    const drafts: BrainPageDraft[] = [];

    if (kind === "repo") {
      drafts.push({
        slug: `github/repos/${owner}-${repo}`,
        title: `${owner}/${repo}`,
        type: "project",
        content: this.formatRepo(doc),
        frontmatter: {
          source: "github",
          owner,
          repo,
          language: m.language,
          stars: m.stars,
          url: m.url,
        },
        links: [],
        writtenBy: "github-ingestor",
        provenance: { system: "github", id: doc.id, url: m.url as string },
        confidence: 0.95,
      });
    } else if (kind === "issue" || m.isPullRequest) {
      const number = m.number as number;
      const state = m.state as string;
      const isPr = m.isPullRequest as boolean;
      const slug = `github/${owner}-${repo}/${isPr ? "pr" : "issue"}-${number}`;

      drafts.push({
        slug,
        title: `${isPr ? "PR" : "Issue"} #${number}: ${m.title}`,
        type: isPr ? "pull_request" : "issue",
        content: this.formatIssueOrPR(doc, isPr),
        frontmatter: {
          source: "github",
          owner,
          repo,
          number,
          state,
          url: m.url,
          labels: m.labels,
        },
        links: [
          { to: `github/repos/${owner}-${repo}`, type: "reported_in" },
          { to: `people/github-${m.author}`, type: "authored_by" },
          ...(m.labels as string[] ?? []).map((l: string) => ({
            to: `concepts/label-${l.toLowerCase().replace(/\s+/g, "-")}`,
            type: "tagged_with",
          })),
        ],
        timeline: [
          {
            date: doc.createdAt.toISOString().split("T")[0],
            summary: `${isPr ? "Pull request" : "Issue"} #${number} ${state}`,
            detail: m.title as string,
          },
        ],
        writtenBy: "github-ingestor",
        provenance: { system: "github", id: doc.id, url: m.url as string },
        confidence: 0.85,
      });
    } else if (kind === "pr") {
      const number = m.number as number;
      const state = m.state as string;
      const merged = m.merged as boolean;
      const slug = `github/${owner}-${repo}/pr-${number}`;

      drafts.push({
        slug,
        title: `PR #${number}: ${m.title}`,
        type: "pull_request",
        content: this.formatIssueOrPR(doc, true),
        frontmatter: {
          source: "github",
          owner,
          repo,
          number,
          state,
          merged,
          url: m.url,
          labels: m.labels,
        },
        links: [
          { to: `github/repos/${owner}-${repo}`, type: merged ? "merged_into" : "opened_in" },
          { to: `people/github-${m.author}`, type: "authored_by" },
          ...(m.labels as string[] ?? []).map((l: string) => ({
            to: `concepts/label-${l.toLowerCase().replace(/\s+/g, "-")}`,
            type: "tagged_with",
          })),
        ],
        timeline: [
          {
            date: doc.createdAt.toISOString().split("T")[0],
            summary: `PR #${number} ${merged ? "merged" : state}`,
            detail: m.title as string,
          },
        ],
        writtenBy: "github-ingestor",
        provenance: { system: "github", id: doc.id, url: m.url as string },
        confidence: 0.85,
      });
    }

    return drafts;
  }

  // ── Private helpers ─────────────────────────────────────────────

  private async listRepos(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/user/repos?per_page=100&sort=updated`, {
      headers: {
        Authorization: `Bearer ${this.config!.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`GitHub repos failed: ${data.message || res.statusText}`);
    return data.map((r: any) => r.full_name);
  }

  private async fetchIssues(owner: string, repo: string): Promise<any[]> {
    const res = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/issues?state=all&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${this.config!.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`GitHub issues failed: ${data.message || res.statusText}`);
    return data ?? [];
  }

  private async fetchPRs(owner: string, repo: string): Promise<any[]> {
    const res = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/pulls?state=all&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${this.config!.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`GitHub PRs failed: ${data.message || res.statusText}`);
    return data ?? [];
  }

  private async fetchRepo(owner: string, repo: string): Promise<any | null> {
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${this.config!.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) return null;
    return res.json();
  }

  private formatRepo(doc: RawDocument): string {
    const m = doc.metadata;
    return [
      `## ${m.title}`,
      "",
      `**Language:** ${m.language || "N/A"}`,
      `**Stars:** ${m.stars ?? 0}`,
      `**URL:** ${m.url}`,
      "",
      m.description || "",
    ].join("\n");
  }

  private formatIssueOrPR(doc: RawDocument, isPr: boolean): string {
    const m = doc.metadata;
    return [
      `> **${isPr ? "Pull Request" : "Issue"} #${m.number}**`,
      `> **State:** ${m.state}${m.merged ? " (merged)" : ""}`,
      `> **Author:** @${m.author}`,
      `> **Repo:** ${m.owner}/${m.repo}`,
      `> **URL:** ${m.url}`,
      `> **Labels:** ${(m.labels as string[])?.join(", ") || "none"}`,
      "",
      doc.content,
    ].join("\n");
  }
}

registerIngestor("github", GitHubIngestor);
