/**
 * Timeline command — show timeline entries for a page.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, formatTimeline } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function timelineCommand(
  slug: string,
  config: CliConfig,
  opts: GlobalOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const entries = await brain.timeline(slug);

    if (opts.json) {
      output(entries ?? [], opts);
      return;
    }

    console.log(formatTimeline(entries ?? []));
  } catch (err) {
    handleError(err, opts);
  }
}
