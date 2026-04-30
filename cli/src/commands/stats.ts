/**
 * Stats command — detailed brain statistics (alias for health with more detail).
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, formatHealth } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function statsCommand(
  config: CliConfig,
  opts: GlobalOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const data = await brain.stats();

    if (!data) {
      console.log("No stats available.");
      return;
    }

    if (opts.json) {
      output(data, opts);
      return;
    }

    console.log(formatHealth(data));
  } catch (err) {
    handleError(err, opts);
  }
}
