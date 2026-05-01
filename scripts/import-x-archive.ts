/**
 * X Archive Importer — loads Twitter archive data into Brainbase Supabase.
 * Run with: node scripts/import-x-archive.mjs
 * 
 * Imports: @mentioned users as pages, tweets as timeline entries, links between people.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read .env.local
function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) {
        const key = match[1];
        let val = match[2].replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
    console.log("Loaded .env.local");
  } catch (e) {
    console.log("No .env.local found, using process.env");
  }
}

loadEnv();

const DB_URL = process.env.SUPABASE_DATABASE_URL;
if (!DB_URL) { console.error("No SUPABASE_DATABASE_URL"); process.exit(1); }

// Extract connection params from postgresql:// URL
const url = new URL(DB_URL);
const supabase = createClient(
  `https://${url.hostname}`,
  "placeholder", // anon key not needed for direct pg
  { db: { schema: "public" },
    auth: { persistSession: false }
  }
);

interface XUser {
  slug: string;
  title: string;
  handle: string;
  type: "person" | "company";
  bio?: string;
}

// High-signal users Preetham interacts with on X
const IMPORT_USERS: XUser[] = [
  { slug: "companies/cursor", title: "Cursor", handle: "cursor_ai", type: "company", bio: "AI-first code editor" },
  { slug: "theo-browne", title: "Theo Browne", handle: "theo", type: "person", bio: "t3.gg creator, developer content" },
  { slug: "yacine", title: "Yacine", handle: "yacineMTB", type: "person", bio: "AI/tech commentator" },
  { slug: "raj-mocherla-x", title: "Raj Mocherla", handle: "RajMocherla", type: "person", bio: "Family friend" },
  { slug: "companies/npm", title: "npm", handle: "npmjs", type: "company", bio: "JavaScript package registry" },
  { slug: "jayair", title: "Jay", handle: "jayair", type: "person", bio: "X contact" },
  { slug: "ethan-lipnik", title: "Ethan Lipnik", handle: "EthanLipnik", type: "person", bio: "X contact" },
  { slug: "tereza-tizkova", title: "Tereza Tizkova", handle: "tereza_tizkova", type: "person", bio: "X contact" },
  { slug: "nbc-washington", title: "NBC Washington", handle: "nbcwashington", type: "company", bio: "News outlet" },
];

async function importUser(user: XUser): Promise<number | null> {
  // Check if page exists
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
    [BRAIN_ID, user.slug]
  );
  if (existing) {
    console.log(`  ⏭️  ${user.slug} already exists (id=${existing.id})`);
    return existing.id;
  }

  const frontmatter = JSON.stringify({
    type: user.type,
    source: "x-archive",
    twitter: `@${user.handle}`,
  });

  const compiledTruth = `# ${user.title}\n\n${user.bio || ""}\n\n- **X:** @${user.handle}\n- **Source:** X archive import`;

  const result = await queryOne<{ id: number }>(
    `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, frontmatter, search_vector, written_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, to_tsvector('english', $5), 'system')
     ON CONFLICT (brain_id, slug) DO UPDATE SET
       compiled_truth = EXCLUDED.compiled_truth,
       frontmatter = EXCLUDED.frontmatter,
       updated_at = NOW()
     RETURNING id`,
    [BRAIN_ID, user.slug, user.title, user.type, compiledTruth, frontmatter]
  );

  if (result) {
    console.log(`  ✅ Created ${user.slug} (id=${result.id})`);
    return result.id;
  }
  return null;
}

async function addLink(fromSlug: string, toSlug: string, linkType: string) {
  try {
    await query(
      `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, written_by)
       VALUES (
         $1,
         (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2),
         (SELECT id FROM pages WHERE brain_id = $1 AND slug = $3),
         $4, 'system'
       )
       ON CONFLICT DO NOTHING`,
      [BRAIN_ID, fromSlug, toSlug, linkType]
    );
    console.log(`  🔗 ${fromSlug} --[${linkType}]--> ${toSlug}`);
  } catch (err: any) {
    console.error(`  ❌ Link error ${fromSlug} → ${toSlug}:`, err.message);
  }
}

async function addTimelineEntry(slug: string, date: string, summary: string, detail: string) {
  try {
    await query(
      `INSERT INTO timeline_entries (brain_id, page_id, date, summary, detail, source, written_by)
       VALUES (
         $1,
         (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2),
         $3, $4, $5, 'x-archive', 'system'
       )
       ON CONFLICT DO NOTHING`,
      [BRAIN_ID, slug, date, summary, detail]
    );
    console.log(`  📅 [${date}] ${summary.slice(0, 60)}`);
  } catch (err: any) {
    console.error(`  ❌ Timeline error for ${slug}:`, err.message);
  }
}

async function main() {
  console.log(`🧠 Importing X archive to brain ${BRAIN_ID}\n`);

  // Phase 1: Create pages for key contacts
  console.log("── Phase 1: Creating contact pages ──");
  for (const user of IMPORT_USERS) {
    await importUser(user);
  }

  // Phase 2: Create links from contacts → preetham-kyanam
  console.log("\n── Phase 2: Creating links ──");
  for (const user of IMPORT_USERS) {
    await addLink("preetham-kyanam", user.slug, "mentioned");
  }

  // Phase 3: Add notable tweet timeline entries
  console.log("\n── Phase 3: Adding tweet timeline entries ──");
  const notableTweets: Array<{ date: string; summary: string; detail: string }> = [
    { date: "2026-04-29", summary: "Tweet: AI agent management with @yacineMTB", detail: "discussed difficulty of managing multiple AI agents simultaneously" },
    { date: "2026-04-29", summary: "Tweet: npm outage report", detail: "@npmjs down? can't login to publish packages" },
    { date: "2026-04-24", summary: "Tweet: Codex + Cursor agent workflow", detail: "Codex literally has a button to open code in Cursor. Now Cursor has an updated agent mode." },
    { date: "2026-04-24", summary: "Tweet: Sony OLED vs LG discussion", detail: "@EthanLipnik @luciascarlet discussion about Sony OLED pricing vs LG" },
    { date: "2026-10-06", summary: "Tweet: 2000th tweet milestone", detail: "OMG MY 2000TH TWEET, I BETTER SAY SOMETHING SMART" },
    { date: "2026-10-01", summary: "Tweet: SAT at Stone Bridge", detail: "Seeing all these people at Stone Bridge taking the SAT" },
  ];

  for (const tweet of notableTweets) {
    await addTimelineEntry("preetham-kyanam", tweet.date, tweet.summary, tweet.detail);
  }

  console.log("\n✅ Import complete!");
  console.log(`   Created/updated: ${IMPORT_USERS.length} pages`);
  console.log(`   Added links: ${IMPORT_USERS.length}`);
  console.log(`   Added timeline entries: ${notableTweets.length}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
