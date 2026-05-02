/**
 * API keys command — manage API keys.
 */

import { Brainbase } from "brainbase-sdk";
import { GlobalOptions, CliConfig } from "../types.js";
import { output, success } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";
import chalk from "chalk";

export interface ApiKeysOptions extends GlobalOptions {
  name?: string;
  revoke?: string;
}

export async function apiKeysCommand(
  config: CliConfig,
  opts: ApiKeysOptions
): Promise<void> {
  try {
    requireApiKey(config);
    const brain = new Brainbase(buildSdkConfig(config, { brainId: opts.brainId }));

    // Create
    if (opts.name) {
      const key = await brain.createApiKey(opts.name);
      if (opts.json) { output(key, opts); return; }
      console.log(chalk.bold.green(`✓ API key created: ${key.name}`));
      console.log(chalk.bold.yellow(`  Key: ${key.key}`));
      console.log(chalk.gray("  Save this now — it won't be shown again."));
      return;
    }

    // Revoke
    if (opts.revoke) {
      await brain.revokeApiKey(opts.revoke);
      if (!opts.json) success(`API key revoked: ${opts.revoke}`, opts);
      return;
    }

    // List
    const keys = await brain.listApiKeys();
    if (opts.json) { output(keys, opts); return; }

    if (!keys || keys.length === 0) {
      console.log("No API keys found.");
      return;
    }

    console.log(chalk.bold(`API Keys (${keys.length}):`));
    for (const k of keys) {
      console.log(`  ${chalk.gray(k.id)}  ${chalk.cyan(k.name)}  ${chalk.gray(`created ${k.created_at}`)}${k.last_used_at ? chalk.gray(`  last used ${k.last_used_at}`) : ""}`);
    }
  } catch (err) {
    handleError(err, opts);
  }
}
