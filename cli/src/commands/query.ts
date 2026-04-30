/**
 * Query command — natural language query against the brain.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, formatPageLine } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export interface QueryOptions extends GlobalOptions {
  limit?: number;
}

export async function queryCommand(
  question: string,
  config: CliConfig,
  opts: QueryOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const results = await brain.query(question);

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
