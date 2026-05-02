/**
 * Tags command — view and manage tags on pages.
 */

import { Brainbase } from "brainbase-sdk";
import { GlobalOptions, CliConfig } from "../types.js";
import { output, success } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";
import chalk from "chalk";

export interface TagsOptions extends GlobalOptions {
  add?: string;
  remove?: string;
}

export async function tagsCommand(
  slug: string,
  config: CliConfig,
  opts: TagsOptions
): Promise<void> {
  try {
    requireApiKey(config);
    const brain = new Brainbase(buildSdkConfig(config, { brainId: opts.brainId }));

    // Mutate first if requested
    if (opts.add) {
      const result = await brain.addTag(slug, opts.add);
      if (!opts.json) success(`Added tag "${opts.add}" → ${result.tags.join(", ")}`, opts);
      else output(result, opts);
      return;
    }

    if (opts.remove) {
      const result = await brain.removeTag(slug, opts.remove);
      if (!opts.json) success(`Removed tag "${opts.remove}" → ${result.tags.join(", ")}`, opts);
      else output(result, opts);
      return;
    }

    // Read
    const result = await brain.getTags(slug);

    if (opts.json) {
      output(result, opts);
      return;
    }

    if (!result || result.tags.length === 0) {
      console.log(`No tags on ${slug}.`);
      return;
    }

    console.log(chalk.bold(`Tags on ${slug}:`));
    for (const tag of result.tags) {
      console.log(`  • ${chalk.cyan(tag)}`);
    }
  } catch (err) {
    handleError(err, opts);
  }
}
