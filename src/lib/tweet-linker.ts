/**
 * Tweet → Author Linker
 * 
 * Deterministic pass that links ingested tweet pages to their author's person page.
 * Extracts the X handle from the tweet slug or URL, resolves it to a person page,
 * and creates authored_by links. This is what turns the tweet island into an actual graph.
 *
 * Tweet slugs follow the pattern: tweets/<handle>-YYYY-MM-DD-NNN
 * Example: tweets/pkyanam-2026-01-27-002 → handle = "pkyanam"
 */

import { queryOne, queryMany } from "./supabase/client";

interface TweetPage {
  slug: string;
  brain_id: string;
  frontmatter: Record<string, unknown>;
}

interface LinkResult {
  slug: string;
  handle: string | null;
  personSlug: string | null;
  status: "linked" | "no_handle" | "no_person" | "skipped" | "error";
  error?: string;
}

/**
 * Extract the X handle from a tweet slug.
 * Pattern: tweets/<handle>-YYYY-MM-DD-NNN
 */
function extractHandleFromSlug(slug: string): string | null {
  // Must start with tweets/
  if (!slug.startsWith("tweets/")) return null;
  
  const rest = slug.slice("tweets/".length);
  // Handle is everything before the date part: YYYY-MM-DD
  const dateMatch = rest.match(/^(.+?)-(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1].toLowerCase();
  }
  
  // Fallback: just take first segment before any dash
  const firstDash = rest.indexOf("-");
  if (firstDash > 0) {
    return rest.slice(0, firstDash).toLowerCase();
  }
  
  return null;
}

/**
 * Extract the X handle from a tweet URL in frontmatter.
 */
function extractHandleFromUrl(url: string): string | null {
  // https://x.com/pkyanam/status/12345
  const match = url.match(/x\.com\/([^/]+)\/status\//);
  if (match) return match[1].toLowerCase();
  
  // https://twitter.com/pkyanam/status/12345
  const twMatch = url.match(/twitter\.com\/([^/]+)\/status\//);
  if (twMatch) return twMatch[1].toLowerCase();
  
  return null;
}

/**
 * Resolve an X handle to a person page slug.
 * Tries multiple slug patterns:
 *   1. people/<handle>
 *   2. <handle> (bare slug)
 *   3. people/<handle-with-dashes> (for multi-word handles)
 */
async function resolveHandleToPerson(
  brainId: string,
  handle: string
): Promise<string | null> {
  const candidates = [
    `people/${handle}`,
    handle,
    `people/${handle.replace(/_/g, "-")}`,
  ];

  for (const candidate of candidates) {
    const row = await queryOne<{ slug: string }>(
      `SELECT slug FROM pages WHERE brain_id = $1 AND slug = $2`,
      [brainId, candidate]
    );
    if (row) return row.slug;
  }

  return null;
}

/**
 * Link a single tweet to its author.
 */
async function linkTweetToAuthor(
  brainId: string,
  tweet: TweetPage
): Promise<LinkResult> {
  // Try to extract handle from slug
  let handle = extractHandleFromSlug(tweet.slug);
  
  // Fallback: extract from URL in frontmatter
  if (!handle && tweet.frontmatter?.url) {
    handle = extractHandleFromUrl(String(tweet.frontmatter.url));
  }

  if (!handle) {
    return { slug: tweet.slug, handle: null, personSlug: null, status: "no_handle" };
  }

  // Check if already linked
  const existingLink = await queryOne<{ id: string }>(
    `SELECT l.id FROM links l
     JOIN pages p_from ON l.from_page_id = p_from.id
     WHERE l.brain_id = $1 
       AND p_from.slug = $2
       AND l.link_type = 'authored_by'`,
    [brainId, tweet.slug]
  );

  if (existingLink) {
    return { slug: tweet.slug, handle, personSlug: null, status: "skipped" };
  }

  // Resolve handle to person page
  const personSlug = await resolveHandleToPerson(brainId, handle);

  if (!personSlug) {
    // Create a stub person page for the handle
    const title = `@${handle}`;
    await queryOne(
      `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, frontmatter, search_vector, written_by)
       VALUES ($1, $2, $3, 'person', '', $4::jsonb, to_tsvector('english', ''), 'system')
       ON CONFLICT (brain_id, slug) DO NOTHING`,
      [brainId, `people/${handle}`, title, JSON.stringify({ twitter_handle: handle })]
    );
    
    const resolvedSlug = `people/${handle}`;
    
    // Create the authored_by link
    try {
      await queryOne(
        `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, written_by)
         VALUES (
           $1,
           (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2),
           (SELECT id FROM pages WHERE brain_id = $1 AND slug = $3),
           'authored_by',
           'system'
         )
         ON CONFLICT DO NOTHING`,
        [brainId, tweet.slug, resolvedSlug]
      );
      return { slug: tweet.slug, handle, personSlug: resolvedSlug, status: "linked" };
    } catch (err) {
      return { slug: tweet.slug, handle, personSlug: resolvedSlug, status: "error", error: String(err) };
    }
  }

  // Create the authored_by link
  try {
    await queryOne(
      `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, written_by)
       VALUES (
         $1,
         (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2),
         (SELECT id FROM pages WHERE brain_id = $1 AND slug = $3),
         'authored_by',
         'system'
       )
       ON CONFLICT DO NOTHING`,
      [brainId, tweet.slug, personSlug]
    );
    return { slug: tweet.slug, handle, personSlug, status: "linked" };
  } catch (err) {
    return { slug: tweet.slug, handle, personSlug, status: "error", error: String(err) };
  }
}

/**
 * Batch-link tweets to their authors.
 * Finds all tweet pages with no outbound links and creates authored_by edges.
 */
export async function linkTweetsToAuthors(
  brainId: string,
  limit = 100
): Promise<{
  tweetsScanned: number;
  linked: number;
  noHandle: number;
  noPerson: number;
  skipped: number;
  errors: number;
  results: LinkResult[];
}> {
  // Find tweets with zero outbound links (author never linked)
  const tweets = await queryMany<TweetPage>(
    `SELECT p.slug, p.brain_id, p.frontmatter
     FROM pages p
     WHERE p.brain_id = $1
       AND p.type = 'tweet'
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND l.from_page_id = p.id
       )
     LIMIT $2`,
    [brainId, limit]
  );

  const results: LinkResult[] = [];
  let linked = 0, noHandle = 0, noPerson = 0, skipped = 0, errors = 0;

  for (const tweet of tweets) {
    try {
      const result = await linkTweetToAuthor(brainId, tweet);
      results.push(result);
      
      switch (result.status) {
        case "linked": linked++; break;
        case "no_handle": noHandle++; break;
        case "no_person": noPerson++; break;
        case "skipped": skipped++; break;
        case "error": errors++; break;
      }
    } catch (err) {
      results.push({
        slug: tweet.slug,
        handle: null,
        personSlug: null,
        status: "error",
        error: String(err),
      });
      errors++;
    }
  }

  console.log(
    `[brainbase] Tweet linker: ${tweets.length} scanned, ${linked} linked, ` +
    `${skipped} skipped, ${noHandle} no-handle, ${noPerson} no-person, ${errors} errors`
  );

  return {
    tweetsScanned: tweets.length,
    linked,
    noHandle,
    noPerson,
    skipped,
    errors,
    results,
  };
}
