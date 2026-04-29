import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { putPage, addLink } from "@/lib/supabase/write";

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  html_url: string;
  created_at: string;
  updated_at: string;
  fork: boolean;
}

interface GitHubContributor {
  login: string;
  contributions: number;
  avatar_url: string;
}

interface IngestStats {
  repos_processed: number;
  pages_created: number;
  links_created: number;
  errors: string[];
  duration_seconds: number;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
}

async function ghApi<T>(endpoint: string, token?: string): Promise<T> {
  const url = `https://api.github.com/${endpoint}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Brainbase/0.2",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    throw new Error(`GitHub API ${resp.status}: ${resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const stats: IngestStats = {
    repos_processed: 0,
    pages_created: 0,
    links_created: 0,
    errors: [],
    duration_seconds: 0,
  };

  try {
    const { username, token } = (await req.json().catch(() => ({}))) as {
      username?: string;
      token?: string;
    };
    const user = username || "pkyanam";

    // Fetch repos (up to 100, non-forks)
    const repos = await ghApi<GitHubRepo[]>(
      `users/${user}/repos?per_page=100&sort=updated`,
      token
    );
    const owned = repos.filter((r) => !r.fork);

    // Create user page
    const userSlug = `people/${user}`;
    const userContent = `# ${user}\n\nGitHub: https://github.com/${user}\nRepositories: ${repos.length} total, ${owned.length} owned\n`;

    await putPage(auth.brainId, {
      slug: userSlug,
      title: user,
      type: "person",
      content: userContent,
    });
    stats.pages_created++;

    // Process repos
    for (const repo of owned) {
      const name = repo.name;
      const slug = `projects/${slugify(name)}`;

      try {
        const desc = repo.description || "";
        const lang = repo.language || "Unknown";
        const descLine = desc || `A ${lang} project by ${user}`;
        const stars = repo.stargazers_count;
        const topics = repo.topics || [];
        const url = repo.html_url;
        const created = (repo.created_at || "").slice(0, 10);
        const updated = (repo.updated_at || "").slice(0, 10);

        let content = `# ${name}\n\n${descLine}\n\n- **Language:** ${lang}\n- **Stars:** ${stars}`;
        if (topics.length > 0) {
          content += `\n- **Topics:** ${topics.slice(0, 8).join(", ")}`;
        }
        content += `\n- **Created:** ${created}\n- **Updated:** ${updated}\n- **URL:** ${url}\n`;

        await putPage(auth.brainId, {
          slug,
          title: name,
          type: "project",
          content,
        });
        stats.pages_created++;
        stats.repos_processed++;

        // Link user → project
        await addLink(auth.brainId, userSlug, slug, "owns");
        stats.links_created++;

        // Fetch top contributors (skip self)
        try {
          const contribs = await ghApi<GitHubContributor[]>(
            `repos/${repo.full_name}/contributors?per_page=3`,
            token
          );
          for (const c of contribs) {
            if (c.login === user) continue;
            const personSlug = `people/${c.login.toLowerCase()}`;
            const personContent = `# ${c.login}\n\nGitHub contributor. ${c.contributions} contributions to [[${slug}]].\nAvatar: ${c.avatar_url}\n`;

            await putPage(auth.brainId, {
              slug: personSlug,
              title: c.login,
              type: "person",
              content: personContent,
            });
            stats.pages_created++;

            await addLink(auth.brainId, personSlug, slug, "contributed_to");
            stats.links_created++;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          stats.errors.push(`${name}/contributors: ${msg}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        stats.errors.push(`${name}: ${msg}`);
      }
    }

    stats.duration_seconds = Math.round((Date.now() - start) / 100) / 10;
    return NextResponse.json({ ...stats, username: user });
  } catch (e: unknown) {
    stats.duration_seconds = Math.round((Date.now() - start) / 100) / 10;
    return NextResponse.json(
      {
        error: "Ingestion failed",
        message: e instanceof Error ? e.message : "Unknown error",
        ...stats,
      },
      { status: 500 }
    );
  }
}
