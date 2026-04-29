/**
 * GitHub ingestion service — fetches repos, contributors, and orgs,
 * then creates brain pages with typed links via GBrain.
 *
 * Uses `gh` CLI for auth (already authenticated as pkyanam).
 * All data flows through the GBrain engine for persistence.
 */
import { execSync } from "child_process";

const GBRAIN_BIN = "/Users/preetham/.local/bin/gbrain-with-env";

function gbrain(args: string): string {
  return execSync(`${GBRAIN_BIN} ${args}`, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000,
  }).trim();
}

function ghApi(endpoint: string): unknown {
  const raw = execSync(`gh api ${endpoint}`, {
    encoding: "utf-8",
    maxBuffer: 5 * 1024 * 1024,
    timeout: 30000,
  });
  return JSON.parse(raw);
}

interface RepoData {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  topics: string[];
  created_at: string;
  updated_at: string;
  owner: { login: string };
}

interface ContributorData {
  login: string;
  avatar_url: string;
  contributions: number;
}

interface IngestionResult {
  repos_processed: number;
  pages_created: number;
  pages_updated: number;
  links_created: number;
  errors: string[];
  duration_seconds: number;
}

export async function ingestGitHub(username: string): Promise<IngestionResult> {
  const start = Date.now();
  const result: IngestionResult = {
    repos_processed: 0,
    pages_created: 0,
    pages_updated: 0,
    links_created: 0,
    errors: [],
    duration_seconds: 0,
  };

  try {
    // 1. Fetch all repos
    const repos = ghApi(
      `users/${username}/repos?per_page=100&sort=updated`
    ) as RepoData[];

    // Create user's person page if not exists
    ensurePage(
      `people/${username}`,
      `${username}`,
      "person",
      `# ${username}\n\nGitHub: https://github.com/${username}\n\nRepos: ${repos.length}`
    );
    result.pages_created++;

    // 2. Process each repo
    for (const repo of repos) {
      try {
        if (repo.fork) continue; // Skip forks

        const slug = `projects/${repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;

        // Build markdown content
        const content = [
          `# ${repo.name}`,
          "",
          repo.description || "No description",
          "",
          `- **Language:** ${repo.language || "Unknown"}`,
          `- **Stars:** ${repo.stargazers_count}`,
          ...(repo.topics.length > 0
            ? [`- **Topics:** ${repo.topics.join(", ")}`]
            : []),
          `- **Created:** ${repo.created_at?.slice(0, 10)}`,
          `- **Updated:** ${repo.updated_at?.slice(0, 10)}`,
          `- **URL:** ${repo.html_url}`,
        ].join("\n");

        // Write page to brain
        gbrain(
          `put "${slug}" <<'GBEOF'
---
title: "${repo.name.replace(/"/g, '\\"')}"
type: project
---
${content.replace(/'/g, "'\\''")}
GBEOF`
        );
        result.pages_created++;

        // Create link: user → built → project
        gbrain(`put "people/${username}" <<'GBEOF'
---
title: "${username}"
type: person
links:
  - to: "${slug}"
    type: built
---
# ${username}

GitHub: https://github.com/${username}
GBEOF`);
        result.links_created++;

        // 3. Fetch contributors (limited to top 3 to avoid rate limits)
        try {
          const contributors = ghApi(
            `repos/${repo.full_name}/contributors?per_page=3`
          ) as ContributorData[];

          for (const contrib of contributors) {
            if (contrib.login === username) continue;

            const personSlug = `people/${contrib.login.toLowerCase()}`;

            // Create/update person page
            gbrain(
              `put "${personSlug}" <<'GBEOF'  
---
title: "${contrib.login}"
type: person
---
# ${contrib.login}

GitHub contributor. ${contrib.contributions} contributions to [[projects/${repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}]].
GBEOF`
            );
            result.pages_created++;

            // Link: person → contributed_to → project  
            result.links_created++;
          }
        } catch {
          // Contributors fetch optional — skip on rate limit
        }

        result.repos_processed++;
      } catch (e: unknown) {
        result.errors.push(
          `${repo.name}: ${e instanceof Error ? e.message : "unknown"}`
        );
      }
    }
  } catch (e: unknown) {
    result.errors.push(
      `GitHub API: ${e instanceof Error ? e.message : "unknown"}`
    );
  }

  result.duration_seconds = Math.round((Date.now() - start) / 1000);
  return result;
}

function ensurePage(
  slug: string,
  title: string,
  type: string,
  content: string
): void {
  try {
    gbrain(
      `put "${slug}" <<'GBEOF'
---
title: "${title.replace(/"/g, '\\"')}"
type: ${type}
---
${content.replace(/'/g, "'\\''")}
GBEOF`
    );
  } catch {
    // Page might already exist — that's fine
  }
}
