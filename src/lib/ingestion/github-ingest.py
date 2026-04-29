#!/usr/bin/env python3
"""
GitHub ingestion pipeline for Brainbase.
Fetches repos via GitHub API (OAuth token or gh CLI),
creates brain pages via gbrain CLI.
Multi-tenant: accepts username and optional --token flag.
"""
import json
import subprocess
import tempfile
import os
import sys
import time
import re
import urllib.request
import urllib.error

GBRAIN = os.environ.get("GBRAIN_BIN", os.path.expanduser("~/.local/bin/gbrain-with-env"))

# ─── GitHub API ───────────────────────────────────────

def gh_api(endpoint: str, token: str | None = None) -> list | dict:
    """Fetch from GitHub API. Uses OAuth token if available, else gh CLI."""
    if token or os.environ.get("GITHUB_TOKEN"):
        t = token or os.environ["GITHUB_TOKEN"]
        url = f"https://api.github.com/{endpoint}"
        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Bearer {t}")
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("User-Agent", "Brainbase/0.2")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"GitHub API {e.code}: {e.reason}")
    else:
        result = subprocess.run(
            ["gh", "api", endpoint],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            raise RuntimeError(f"gh api failed: {result.stderr[:200]}")
        return json.loads(result.stdout)

# ─── GBrain page writer ───────────────────────────────

def gbrain_put(slug: str, title: str, ptype: str, content: str) -> bool:
    """Write a page to GBrain via temp file."""
    frontmatter = f'---\ntitle: "{title}"\ntype: {ptype}\n---\n'
    full = frontmatter + content
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(full)
        tmp = f.name
    try:
        subprocess.run(
            [GBRAIN, "put", slug],
            stdin=open(tmp),
            capture_output=True, text=True, timeout=15, check=True
        )
        return True
    except Exception as e:
        print(f"  ⚠️ {slug}: {e}", file=sys.stderr)
        return False
    finally:
        os.unlink(tmp)

def slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9-]', '-', name.lower()).strip('-')

# ─── Main ingestion ───────────────────────────────────

def main():
    # Parse args: python3 github-ingest.py <username> [--token <gh_token>]
    args = sys.argv[1:]
    token = None
    username = "pkyanam"
    
    i = 0
    while i < len(args):
        if args[i] == "--token" and i + 1 < len(args):
            token = args[i + 1]
            i += 2
        elif not args[i].startswith("--"):
            username = args[i]
            i += 1
        else:
            i += 1

    start = time.time()
    stats = {
        "repos_processed": 0,
        "pages_created": 0,
        "links_created": 0,
        "errors": [],
    }

    print(f"🔍 Fetching repos for {username}...")

    try:
        repos = gh_api(f"users/{username}/repos?per_page=100&sort=updated", token)
    except Exception as e:
        print(f"❌ GitHub API error: {e}")
        sys.exit(1)

    owned = [r for r in repos if not r.get("fork")]
    print(f"📦 Found {len(owned)} owned repos")

    # User page
    user_slug = f"people/{username}"
    user_content = f"""# {username}

GitHub: https://github.com/{username}
Repositories: {len(repos)} total, {len(owned)} owned
"""
    if gbrain_put(user_slug, username, "person", user_content):
        stats["pages_created"] += 1
        print(f"  ✅ {user_slug}")

    # Process repos
    for repo in owned:
        name = repo["name"]
        slug = f"projects/{slugify(name)}"
        print(f"\n📂 {name} → {slug}")

        try:
            desc = repo.get("description") or ""
            lang = repo.get("language") or "Unknown"
            desc_line = desc or f"A {lang} project by {username}"
            stars = repo.get("stargazers_count", 0)
            topics = repo.get("topics", [])
            url = repo.get("html_url", "")
            created = (repo.get("created_at") or "")[:10]
            updated = (repo.get("updated_at") or "")[:10]

            content = f"""# {name}

{desc_line}

- **Language:** {lang}
- **Stars:** {stars}"""
            if topics:
                content += f"\n- **Topics:** {', '.join(topics[:8])}"
            content += f"""
- **Created:** {created}
- **Updated:** {updated}
- **URL:** {url}
"""
            if gbrain_put(slug, name, "project", content):
                stats["pages_created"] += 1
                stats["links_created"] += 1
                stats["repos_processed"] += 1
                print(f"  ✅ {name} ({lang}, {stars}★)")

            # Contributors
            try:
                contribs = gh_api(
                    f"repos/{repo['full_name']}/contributors?per_page=3", token
                )
                for c in contribs:
                    if c["login"] == username:
                        continue
                    person_slug = f"people/{c['login'].lower()}"
                    person_content = f"""# {c['login']}

GitHub contributor. {c['contributions']} contributions to [[{slug}]].
Avatar: {c.get('avatar_url', '')}
"""
                    if gbrain_put(person_slug, c['login'], "person", person_content):
                        stats["pages_created"] += 1
                        stats["links_created"] += 1
                        print(f"    👤 {c['login']} ({c['contributions']} contribs)")
            except Exception as e:
                print(f"    ⚠️ Contributors: {e}")

        except Exception as e:
            stats["errors"].append(f"{name}: {e}")
            print(f"  ❌ {e}")

    duration = round(time.time() - start, 1)
    stats["duration_seconds"] = duration

    print(f"\n{'='*50}")
    print(f"✅ Done in {duration}s")
    print(f"   Repos processed: {stats['repos_processed']}")
    print(f"   Pages created:   {stats['pages_created']}")
    print(f"   Links created:   {stats['links_created']}")
    if stats["errors"]:
        print(f"   Errors: {len(stats['errors'])}")
        for e in stats["errors"][:5]:
            print(f"     - {e}")

    print("\n--- RESULT JSON ---")
    print(json.dumps(stats, indent=2))

if __name__ == "__main__":
    main()
