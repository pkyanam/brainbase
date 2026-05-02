/**
 * Raw-data command — view stored provenance data for a page.
 */

import { Brainbase } from "brainbase-sdk";
import { GlobalOptions, CliConfig } from "../types.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";
import chalk from "chalk";

export interface RawDataOptions extends GlobalOptions {
  source?: string;
}

export async function rawDataCommand(
  slug: string,
  config: CliConfig,
  opts: RawDataOptions
): Promise<void> {
  try {
    requireApiKey(config);
    const brain = new Brainbase(buildSdkConfig(config, { brainId: opts.brainId }));

    const data = await brain.getRawData(slug, opts.source);

    if (opts.json) {
      output(data, opts);
      return;
    }

    if (!data || data.length === 0) {
      console.log(`No raw data stored for ${slug}.`);
      return;
    }

    for (const entry of data) {
      console.log(chalk.bold(`[${entry.source}]`));
      if (typeof entry.data === "string") {
        console.log(entry.data.slice(0, 1000));
        if ((entry.data as string).length > 1000) console.log(chalk.gray("...truncated"));
      } else {
        console.log(JSON.stringify(entry.data, null, 2).slice(0, 1000));
      }
      console.log("");
    }
  } catch (err) {
    handleError(err, opts);
  }
}
