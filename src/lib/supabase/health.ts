import { queryOne, queryMany } from "./client";

export interface BrainHealth {
  page_count: number;
  chunk_count: number;
  link_count: number;
  embed_coverage: number;
  brain_score: number;
  pages_by_type: Record<string, number>;
  most_connected: { slug: string; title: string; link_count: number }[];
}

export async function getHealth(brainId: string): Promise<BrainHealth> {
  const typeRows = await queryMany<{ type: string; count: string }>(
    `SELECT type, COUNT(*) as count FROM pages WHERE brain_id = $1 GROUP BY type ORDER BY count DESC`,
    [brainId]
  );
  const pages_by_type: Record<string, number> = {};
  let pageCount = 0;
  for (const r of typeRows) {
    pages_by_type[r.type] = parseInt(r.count);
    pageCount += parseInt(r.count);
  }

  const chunkRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM content_chunks WHERE brain_id = $1`,
    [brainId]
  );
  const chunkCount = parseInt(chunkRow?.count || "0");

  const linkRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM links WHERE brain_id = $1`,
    [brainId]
  );
  const linkCount = parseInt(linkRow?.count || "0");

  const embedRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM content_chunks WHERE brain_id = $1 AND embedding IS NOT NULL`,
    [brainId]
  );
  const embedCoverage = chunkCount > 0
    ? Math.round((parseInt(embedRow?.count || "0") / chunkCount) * 100)
    : 0;

  const topRows = await queryMany<{ slug: string; title: string; link_count: string }>(
    `SELECT p.slug, p.title, COUNT(l.id) as link_count
     FROM pages p
     LEFT JOIN links l ON l.brain_id = $1 AND (l.from_page_id = p.id OR l.to_page_id = p.id)
     WHERE p.brain_id = $1
     GROUP BY p.id, p.slug, p.title
     ORDER BY link_count DESC
     LIMIT 5`,
    [brainId]
  );
  const mostConnected = topRows.map(r => ({
    slug: r.slug,
    title: r.title,
    link_count: parseInt(r.link_count),
  }));

  const linkDensity = pageCount > 0 ? linkCount / pageCount : 0;
  const brainScore = Math.min(100, Math.round(
    embedCoverage * 0.35 +
    Math.min(linkDensity * 100, 40) * 0.4 +
    (pageCount > 100 ? 25 : (pageCount / 100) * 25)
  ));

  return {
    page_count: pageCount,
    chunk_count: chunkCount,
    link_count: linkCount,
    embed_coverage: embedCoverage,
    brain_score: brainScore,
    pages_by_type,
    most_connected: mostConnected,
  };
}
