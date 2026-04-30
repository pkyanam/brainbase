/**
 * Delete-page command — remove a page by slug.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, success, warning } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function deletePageCommand(
  slug: string,
  config: CliConfig,
  opts: GlobalOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const result = await brain.deletePage(slug);

    if (opts.json) {
      output(result, opts);
      return;
    }

    if (result?.success) {
      success(`Deleted ${slug}`, opts);
    } else {
      warning(`Page not found: ${slug}`, opts);
    }
  } catch (err) {
    handleError(err, opts);
  }
}
