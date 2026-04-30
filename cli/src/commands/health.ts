/**
 * Health command — display brain health dashboard.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, formatHealth } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function healthCommand(
  config: CliConfig,
  opts: GlobalOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const data = await brain.health();

    if (!data) {
      console.log("No health data available.");
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
