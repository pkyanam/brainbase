/**
 * Links command — show outgoing and incoming links for a page.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, formatLinks } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function linksCommand(
  slug: string,
  config: CliConfig,
  opts: GlobalOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const data = await brain.links(slug);

    if (!data) {
      console.log(`No links found for: ${slug}`);
      return;
    }

    if (opts.json) {
      output(data, opts);
      return;
    }

    console.log(formatLinks(data));
  } catch (err) {
    handleError(err, opts);
  }
}
