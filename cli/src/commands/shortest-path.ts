/**
 * Shortest path command — find the shortest path between two pages.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function shortestPathCommand(
  config: CliConfig,
  fromSlug: string,
  toSlug: string,
  opts: GlobalOptions & { maxDepth?: number }
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const data = await brain.shortestPath(fromSlug, toSlug, opts.maxDepth ?? 6);

    output(data, opts);
  } catch (err) {
    handleError(err, opts);
  }
}
