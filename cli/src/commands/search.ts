/**
 * Search command — full-text search across the brain.
 */

import { Brainbase } from "brainbase-sdk";
import { GlobalOptions } from "../types.js";
import { output, formatPageLine } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";
import { CliConfig } from "../types.js";

export interface SearchOptions extends GlobalOptions {
  limit?: number;
}

export async function searchCommand(
  query: string,
  config: CliConfig,
  opts: SearchOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const results = await brain.search(query);

    if (opts.json) {
      output(results, opts);
      return;
    }

    if (!results || results.length === 0) {
      console.log("No results found.");
      return;
    }

    const limit = opts.limit ?? 20;
    for (const r of results.slice(0, limit)) {
      console.log(formatPageLine(r, opts));
    }
  } catch (err) {
    handleError(err, opts);
  }
}
