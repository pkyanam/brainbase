/**
 * Traverse command — walk the knowledge graph from a starting page.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, formatTraversal } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export interface TraverseOptions extends GlobalOptions {
  depth?: number;
  direction?: "out" | "in" | "both";
}

export async function traverseCommand(
  slug: string,
  config: CliConfig,
  opts: TraverseOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const results = await brain.traverse(slug, {
      depth: opts.depth ?? 2,
      direction: opts.direction ?? "out",
    });

    if (opts.json) {
      output(results ?? [], opts);
      return;
    }

    if (!results || results.length === 0) {
      console.log("No connected pages found.");
      return;
    }

    console.log(
      formatTraversal(
        results,
        slug,
        opts.direction ?? "out",
        opts.depth ?? 2
      )
    );
  } catch (err) {
    handleError(err, opts);
  }
}
