/**
 * Remove-link command — delete a link between two pages.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, success, warning } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export async function removeLinkCommand(
  from: string,
  to: string,
  config: CliConfig,
  opts: GlobalOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const result = await brain.removeLink(from, to);

    if (opts.json) {
      output(result, opts);
      return;
    }

    if (result?.success) {
      success(`Removed link ${from} → ${to}`, opts);
    } else {
      warning(`Link not found`, opts);
    }
  } catch (err) {
    handleError(err, opts);
  }
}
