/**
 * Ask command — natural language question with LLM-generated answer.
 */

import { Brainbase } from "brainbase-sdk";
import { GlobalOptions, CliConfig } from "../types.js";
import { output } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";
import chalk from "chalk";

export interface AskOptions extends GlobalOptions {}

export async function askCommand(
  question: string,
  config: CliConfig,
  opts: AskOptions
): Promise<void> {
  try {
    requireApiKey(config);
    const brain = new Brainbase(buildSdkConfig(config, { brainId: opts.brainId }));

    const result = await brain.ask(question);

    if (opts.json) {
      output(result, opts);
      return;
    }

    if (!result) {
      console.log("No answer returned.");
      return;
    }

    console.log(chalk.bold(result.answer));
    console.log("");
    if (result.sources.length) {
      console.log(chalk.gray(`Sources (confidence: ${Math.round(result.confidence * 100)}%):`));
      for (const s of result.sources.slice(0, 5)) {
        console.log(chalk.gray(`  • ${s.title} (${s.slug})`));
      }
    }
  } catch (err) {
    handleError(err, opts);
  }
}
