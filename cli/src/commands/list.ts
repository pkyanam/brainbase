/**
 * List command — list pages with optional type filter.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, formatPageLine } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export interface ListOptions extends GlobalOptions {
  type?: string;
  limit?: number;
  offset?: number;
}

export async function listCommand(
  config: CliConfig,
  opts: ListOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const pages = await brain.listPages({
      type: opts.type,
      limit: opts.limit,
      offset: opts.offset,
    });

    if (opts.json) {
      output(pages ?? [], opts);
      return;
    }

    if (!pages || pages.length === 0) {
      console.log("No pages found.");
      return;
    }

    for (const p of pages) {
      console.log(formatPageLine(p, opts));
    }
  } catch (err) {
    handleError(err, opts);
  }
}
