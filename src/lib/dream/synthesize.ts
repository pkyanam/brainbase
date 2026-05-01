/**
 * Dream Cycle — Synthesize Phase
 * GBrain v0.25 parity: transcript-to-brain pipeline.
 *
 * Reads recent .txt transcript files, calls an LLM for significance verdict,
 * caches verdicts in dream_verdicts table, and for significant transcripts
 * extracts entities, decisions, and writes brain pages.
 */

import { query, queryOne } from "../supabase/client";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const VERDICT_MODEL = "gpt-5.4-nano";
const SYNTHESIS_MODEL = "deepseek-v4-pro"; // stronger model for extraction
const DREAM_GENERATED_MARKER = "dream_generated: true";

// ── Schema ──────────────────────────────────────────────────────────

export async function ensureDreamSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS dream_verdicts (
      file_path TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      verdict TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (file_path, content_hash)
    )
  `);
}

// ── Helpers ─────────────────────────────────────────────────────────

function hashContent(content: string): string {
  // Simple hash: first 64 chars + length (good enough for dedup)
  const preview = content.trim().slice(0, 200);
  let hash = 0;
  for (let i = 0; i < preview.length; i++) {
    const chr = preview.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `h${Math.abs(hash)}_${content.length}`;
}

async function getSignificanceVerdict(
  filePath: string,
  content: string
): Promise<string> {
  const contentHash = hashContent(content);

  // Check cache
  const cached = await queryOne<{ verdict: string }>(
    `SELECT verdict FROM dream_verdicts WHERE file_path = $1 AND content_hash = $2`,
    [filePath, contentHash]
  );
  if (cached) return cached.verdict;

  // Call LLM for verdict
  if (!OPENAI_API_KEY) return "skip"; // no API key, skip all

  try {
    const preview = content.slice(0, 3000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: VERDICT_MODEL,
        max_completion_tokens: 10,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are a transcript significance classifier. Read the transcript preview and respond with EXACTLY one word: 'significant' or 'skip'. " +
              "Significant transcripts contain strategic decisions, new business relationships, project launches, hiring decisions, " +
              "organizational changes, funding events, product pivots, or competitive intelligence. Skip casual conversation, status updates, " +
              "repetitive daily logs, or transcripts that are purely operational with no new durable information.",
          },
          { role: "user", content: preview },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[dream] Verdict API error:", res.status);
      return "skip";
    }

    const data = await res.json();
    const verdict = data.choices?.[0]?.message?.content?.trim().toLowerCase() || "skip";

    // Cache the verdict
    try {
      await query(
        `INSERT INTO dream_verdicts (file_path, content_hash, verdict)
         VALUES ($1, $2, $3)
         ON CONFLICT (file_path, content_hash) DO NOTHING`,
        [filePath, contentHash, verdict]
      );
    } catch {
      // cache failure is non-fatal
    }

    return verdict === "significant" ? "significant" : "skip";
  } catch (err) {
    console.error("[dream] Verdict error:", err);
    return "skip";
  }
}

// ── Main synthesize phase ───────────────────────────────────────────

export interface SynthesizeResult {
  transcriptsScanned: number;
  significantFound: number;
  pagesCreated: number;
  skipped: number;
  errors: number;
}

export async function runSynthesizePhase(
  brainId: string
): Promise<SynthesizeResult> {
  await ensureDreamSchema();

  const result: SynthesizeResult = {
    transcriptsScanned: 0,
    significantFound: 0,
    pagesCreated: 0,
    skipped: 0,
    errors: 0,
  };

  // Find transcript files — look in common locations
  // In production, these come from Hermes session transcripts
  const transcriptDirs = [
    "~/.hermes/transcripts",
    "~/.hermes/sessions",
  ];

  // For now, scan the brain for any page that looks like a transcript
  const transcriptPages = await query<{
    slug: string;
    title: string;
    compiled_truth: string;
  }>(
    `SELECT slug, title, COALESCE(compiled_truth, '') as compiled_truth
     FROM pages
     WHERE brain_id = $1
       AND type IN ('transcript', 'session', 'note')
       AND compiled_truth IS NOT NULL
       AND compiled_truth != ''
       AND slug NOT LIKE 'dream-%'
       AND (frontmatter->>'dream_generated')::boolean IS NOT TRUE
     ORDER BY updated_at DESC
     LIMIT 20`,
    [brainId]
  );

  result.transcriptsScanned = transcriptPages.rows.length;

  for (const row of transcriptPages.rows) {
    try {
      const verdict = await getSignificanceVerdict(row.slug, row.compiled_truth);

      if (verdict === "significant") {
        result.significantFound++;

        // Create a synthesized page
        const synthSlug = `dream-${row.slug.replace(/[^a-z0-9-]/g, "-").slice(0, 80)}`;
        const synthTitle = `Dream: ${row.title}`;

        // Check if page already exists
        const existing = await queryOne<{ slug: string }>(
          `SELECT slug FROM pages WHERE brain_id = $1 AND slug = $2`,
          [brainId, synthSlug]
        );

        if (!existing) {
          // Create the synthesized page
          const analysis = await synthesizeTranscript(row.compiled_truth);
          const content = buildSynthesizedContent(row.title, analysis);

          await query(
            `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, frontmatter)
             VALUES ($1, $2, $3, 'dream', $4, $5::jsonb)`,
            [
              brainId,
              synthSlug,
              synthTitle,
              content,
              JSON.stringify({
                dream_generated: true,
                source_transcript: row.slug,
                synthesized_at: new Date().toISOString(),
              }),
            ]
          );

          result.pagesCreated++;
        }
      } else {
        result.skipped++;
      }
    } catch (err) {
      console.error(`[dream] Synthesize error for ${row.slug}:`, err);
      result.errors++;
    }
  }

  return result;
}

// ── LLM synthesis ───────────────────────────────────────────────────

async function synthesizeTranscript(content: string): Promise<{
  entities: string[];
  decisions: string[];
  summary: string;
}> {
  if (!OPENAI_API_KEY) {
    return { entities: [], decisions: [], summary: "No API key configured" };
  }

  const preview = content.slice(0, 4000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: VERDICT_MODEL,
        max_completion_tokens: 500,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Extract structured information from this transcript. Return ONLY valid JSON with these keys:\n" +
              '- "entities": array of people, companies, projects, or concepts mentioned\n' +
              '- "decisions": array of decisions made or commitments stated\n' +
              '- "summary": one-sentence summary of the key takeaway\n' +
              'Example: {"entities":["Alice","Stripe"],"decisions":["Switch to Postgres"],"summary":"Team decided to migrate database to Postgres by Q3."}',
          },
          { role: "user", content: preview },
        ],
      }),
    });

    if (!res.ok) return { entities: [], decisions: [], summary: "API error" };

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return { entities: [], decisions: [], summary: "" };

    const parsed = JSON.parse(raw.trim());
    return {
      entities: parsed.entities || [],
      decisions: parsed.decisions || [],
      summary: parsed.summary || "",
    };
  } catch (err) {
    console.error("[dream] Synthesis extraction error:", err);
    return { entities: [], decisions: [], summary: "" };
  }
}

function buildSynthesizedContent(
  title: string,
  analysis: { entities: string[]; decisions: string[]; summary: string }
): string {
  const lines = [
    `# ${title}`,
    "",
    `> ${analysis.summary}`,
    "",
  ];

  if (analysis.entities.length > 0) {
    lines.push("## Entities Mentioned");
    for (const e of analysis.entities) {
      lines.push(`- ${e}`);
    }
    lines.push("");
  }

  if (analysis.decisions.length > 0) {
    lines.push("## Decisions Made");
    for (const d of analysis.decisions) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Synthesized by Dream Cycle at ${new Date().toISOString()}*`);

  return lines.join("\n");
}
