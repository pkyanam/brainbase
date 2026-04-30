/**
 * Graph command — dump the full knowledge graph as JSON.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function graphCommand(
  config: CliConfig,
  opts: GlobalOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const data = await brain.graph();

    output(data ?? {}, opts);
  } catch (err) {
    handleError(err, opts);
  }
}
