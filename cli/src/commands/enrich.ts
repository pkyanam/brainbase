/**
 * Enrich command — create rich, sourced pages for people and companies.
 */

import { Brainbase } from "brainbase-sdk";
import { GlobalOptions, CliConfig } from "../types.js";
import { output, success } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";
import chalk from "chalk";

export interface EnrichOptions extends GlobalOptions {
  tier?: string;
  type?: string;
  context?: string;
  force?: boolean;
}

export async function enrichCommand(
  name: string,
  config: CliConfig,
  opts: EnrichOptions
): Promise<void> {
  try {
    requireApiKey(config);
    const brain = new Brainbase(buildSdkConfig(config, { brainId: opts.brainId }));

    const tier = opts.tier ? parseInt(opts.tier) : 2;
    if (![1, 2, 3].includes(tier)) throw new Error("Tier must be 1, 2, or 3");

    const result = await brain.enrich({
      name,
      type: (opts.type as "person" | "company" | "auto") || "auto",
      tier: tier as 1 | 2 | 3,
      context: opts.context,
      force: opts.force,
    });

    if (opts.json) {
      output(result, opts);
      return;
    }

    if ("queued" in result) {
      console.log(chalk.cyan(`⏳ Enrichment queued as job #${result.jobId}`));
      console.log(chalk.gray(`   Tier ${result.tier} — check status: brainbase jobs ${result.jobId}`));
      return;
    }

    console.log(chalk.bold.green(`✓ ${result.action} ${result.type}/${result.slug}`));
    console.log(chalk.gray(`  Sources: ${result.sources.join(", ")}`));
    console.log(chalk.gray(`  Links created: ${result.linksCreated}  |  Raw data stored: ${result.rawDataStored}`));
    if (result._diag) {
      console.log(chalk.gray(`  Brave: ${result._diag.braveCalled ? `✓ (${result._diag.braveResults} results)` : "✗ not called"}`));
    }
    if (result.newSignals.length) {
      console.log(chalk.gray(`  Signals: ${result.newSignals.slice(0, 3).join("; ")}`));
    }
    success(`Enrichment complete: ${result.slug}`, opts);
  } catch (err) {
    handleError(err, opts);
  }
}
