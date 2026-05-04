/**
 * Communities command — detect communities using Louvain algorithm.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function communitiesCommand(
  config: CliConfig,
  opts: GlobalOptions & { limit?: number }
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const data = await brain.communities(opts.limit ?? 500);

    output(data, opts);
  } catch (err) {
    handleError(err, opts);
  }
}
