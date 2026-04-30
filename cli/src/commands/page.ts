/**
 * Page command — retrieve a specific page by slug.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, formatPageDetail } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function pageCommand(
  slug: string,
  config: CliConfig,
  opts: GlobalOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const page = await brain.getPage(slug);

    if (!page) {
      console.log(`Page not found: ${slug}`);
      return;
    }

    if (opts.json) {
      output(page, opts);
      return;
    }

    console.log(formatPageDetail(page));
  } catch (err) {
    handleError(err, opts);
  }
}
