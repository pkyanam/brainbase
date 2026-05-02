/**
 * Versions command — view page version history.
 */

import { Brainbase } from "brainbase-sdk";
import { GlobalOptions, CliConfig } from "../types.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";
import chalk from "chalk";

export interface VersionsOptions extends GlobalOptions {}

export async function versionsCommand(
  slug: string,
  config: CliConfig,
  opts: VersionsOptions
): Promise<void> {
  try {
    requireApiKey(config);
    const brain = new Brainbase(buildSdkConfig(config, { brainId: opts.brainId }));

    const versions = await brain.getVersions(slug);

    if (opts.json) {
      output(versions, opts);
      return;
    }

    if (!versions || versions.length === 0) {
      console.log(`No version history for ${slug}.`);
      return;
    }

    console.log(chalk.bold(`Version history for ${slug} (${versions.length} versions):`));
    for (const v of versions) {
      console.log(`  ${chalk.gray(`#${v.id}`)} ${v.created_at} ${chalk.cyan(v.author || "unknown")} — ${v.title}`);
    }
  } catch (err) {
    handleError(err, opts);
  }
}
