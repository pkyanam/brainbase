/**
 * Similar command — find pages similar to a given page.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function similarCommand(
  config: CliConfig,
  slug: string,
  opts: GlobalOptions & { limit?: number }
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const data = await brain.similarPages(slug, opts.limit ?? 10);

    output(data, opts);
  } catch (err) {
    handleError(err, opts);
  }
}
