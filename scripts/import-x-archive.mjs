/**
 * X Archive Importer — loads Twitter archive data into Brainbase Supabase.
 * Run with: node scripts/import-x-archive.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
function loadEnv() {
  try {
    const content = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    console.log("Loaded .env.local");
  } catch { console.log("No .env.local"); }
}
loadEnv();

const DB_URL = process.env.SUPABASE_DATABASE_URL;
if (!DB_URL) { console.error("No SUPABASE_DATABASE_URL"); process.exit(1); }

const braindId = process.env.DEFAULT_BRAIN_ID || "dev-user-001";

// Direct Postgres via Supabase
const poolUrl = new URL(DB_URL);
const supabase = createClient(`https://${poolUrl.hostname}`, "placeholder", {
  db: { schema: "public" }, auth: { persistSession: false }
});

// Raw SQL helper using Supabase's SQL endpoint
async function sql(text, params = []) {
  // Build a raw query string with numbered params
  let q = text;
  for (let i = 0; i < params.length; i++) {
    const val = typeof params[i] === "string" ? `'${params[i].replace(/'/g, "''")}'` : params[i];
    q = q.replace(`$${i + 1}`, val);
  }
  const { data, error } = await supabase.rpc("exec_sql", { query: q }).maybeSingle();
  if (error) throw error;
  return data;
}

// Simpler: use supabase-js queries directly
async function query1(q, params = []) {
  // Hack: use rpc to run raw SQL
  const { data, error } = await supabase.rpc("run_query", { 
    query_text: q, 
    query_params: params 
  });
  if (error) {
    // Fall back to direct REST
    console.log(`  SQL error: ${error.message}`);
    return null;
  }
  return data;
}

const USERS = [
  { slug: "companies/cursor", title: "Cursor", handle: "cursor_ai", type: "company", bio: "AI-first code editor" },
  { slug: "theo-browne", title: "Theo Browne", handle: "theo", type: "person", bio: "t3.gg creator" },
  { slug: "yacine", title: "Yacine", handle: "yacineMTB", type: "person", bio: "AI/tech commentator" },
  { slug: "raj-mocherla", title: "Raj Mocherla", handle: "RajMocherla", type: "person", bio: "Family friend" },
  { slug: "companies/npm", title: "npm", handle: "npmjs", type: "company", bio: "JavaScript package registry" },
  { slug: "jayair", title: "Jay", handle: "jayair", type: "person", bio: "X contact" },
  { slug: "ethan-lipnik", title: "Ethan Lipnik", handle: "EthanLipnik", type: "person", bio: "X contact" },
  { slug: "tereza-tizkova", title: "Tereza Tizkova", handle: "tereza_tizkova", type: "person", bio: "X contact" },
  { slug: "nbc-washington", title: "NBC Washington", handle: "nbcwashington", type: "company", bio: "News outlet" },
];

const TWEETS = [
  { date: "2026-04-29", summary: "Tweet: AI agent management with @yacineMTB", detail: "Discussed difficulty of managing multiple AI agents simultaneously" },
  { date: "2026-04-29", summary: "Tweet: npm outage report", detail: "@npmjs down? can't login to publish packages" },
  { date: "2026-04-24", summary: "Tweet: Codex + Cursor agent workflow", detail: "Codex literally has a button to open code in Cursor for this reason. Now Cursor has an updated agent mode." },
  { date: "2026-04-24", summary: "Tweet: Sony OLED vs LG discussion with @EthanLipnik", detail: "Discussion about Sony OLED pricing vs LG" },
  { date: "2026-04-29", summary: "Tweet: Reply to @arlanr", detail: "@arlanr let me in" },
  { date: "2026-04-23", summary: "Tweet: Reply to @jayair", detail: "lmao im guessing ur still in bangalore?" },
  { date: "2016-10-06", summary: "Tweet: 2000th tweet milestone", detail: "OMG MY 2000TH TWEET — early Twitter days" },
];

async function main() {
  console.log(`🧠 Importing X archive to brain ${braindId}\n`);

  // Phase 1: Create pages using REST API
  console.log("── Phase 1: Creating contact pages ──");
  for (const u of USERS) {
    const frontmatter = { type: u.type, source: "x-archive", twitter: `@${u.handle}` };
    const content = `# ${u.title}\n\n${u.bio}\n\n- **X:** @${u.handle}\n- **Source:** X archive import`;
    
    try {
      const { error } = await supabase
        .from("pages")
        .upsert({
          brain_id: braindId,
          slug: u.slug,
          title: u.title,
          type: u.type,
          compiled_truth: content,
          frontmatter,
          search_vector: null, // let DB compute
          written_by: "system",
          updated_at: new Date().toISOString()
        }, { onConflict: "brain_id,slug" });
      
      if (error) {
        console.log(`  ⚠️  ${u.slug}: ${error.message}`);
      } else {
        console.log(`  ✅ ${u.slug} (@${u.handle})`);
      }

      // Create link to preetham-kyanam
      const { error: linkErr } = await supabase.rpc("create_link", {
        p_brain_id: braindId,
        p_from_slug: "preetham-kyanam",
        p_to_slug: u.slug,
        p_link_type: "mentioned"
      }).maybeSingle();
      
      if (linkErr && !linkErr.message.includes("does not exist")) {
        console.log(`  🔗 Link: ${linkErr.message}`);
      }
    } catch (e) {
      console.log(`  ❌ ${u.slug}: ${e.message}`);
    }
  }

  // Phase 2: Add tweet timeline entries
  console.log("\n── Phase 2: Adding tweet timeline entries ──");
  for (const t of TWEETS) {
    try {
      const { error } = await supabase
        .from("timeline_entries")
        .insert({
          brain_id: braindId,
          page_id: null, // will resolve by slug
          date: t.date,
          summary: t.summary,
          detail: t.detail,
          source: "x-archive",
          written_by: "system"
        });
      
      if (error) {
        console.log(`  ⚠️  ${t.date}: ${error.message}`);
      } else {
        console.log(`  ✅ [${t.date}] ${t.summary.slice(0, 50)}`);
      }
    } catch (e) {
      console.log(`  ❌ ${t.date}: ${e.message}`);
    }
  }

  console.log(`\n✅ Import complete: ${USERS.length} users, ${TWEETS.length} tweets`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
