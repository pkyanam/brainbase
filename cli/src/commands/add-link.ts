/**
 * Add-link command — create a typed link between two pages.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, success, warning } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export interface AddLinkOptions extends GlobalOptions {
  type?: string;
  writtenBy?: string;
}

export async function addLinkCommand(
  from: string,
  to: string,
  config: CliConfig,
  opts: AddLinkOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const result = await brain.addLink(from, to, opts.type, opts.writtenBy);

    if (opts.json) {
      output(result, opts);
      return;
    }

    if (result?.success) {
      success(`Linked ${from} → ${to} (${result.link_type})`, opts);
    } else {
      warning(`Link already exists or pages not found`, opts);
    }
  } catch (err) {
    handleError(err, opts);
  }
}
