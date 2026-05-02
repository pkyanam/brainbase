import "dotenv/config";
import { query, queryMany } from "../src/lib/supabase/client";

async function main() {
  const stale = await query<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM content_chunks WHERE embedding IS NULL"
  );
  console.log("Stale chunks:", stale.rows[0].cnt);

  const byBrain = await queryMany<{ brain_id: string; cnt: string }>(
    "SELECT brain_id, COUNT(*) as cnt FROM content_chunks WHERE embedding IS NULL GROUP BY brain_id ORDER BY cnt DESC"
  );
  console.log("By brain:", byBrain);

  const total = await query<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM content_chunks"
  );
  console.log("Total chunks:", total.rows[0].cnt);
}

main().catch(console.error);
