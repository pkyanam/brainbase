/**
 * Add-timeline command — add a timeline entry to a page.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, success, formatPairs } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export interface AddTimelineOptions extends GlobalOptions {
  detail?: string;
  source?: string;
}

export async function addTimelineCommand(
  slug: string,
  date: string,
  summary: string,
  config: CliConfig,
  opts: AddTimelineOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const result = await brain.addTimelineEntry(slug, date, summary, {
      detail: opts.detail,
      source: opts.source,
    });

    if (opts.json) {
      output(result, opts);
      return;
    }

    if (result?.id) {
      success(`Added timeline entry to ${slug}`, opts);
      console.log(
        formatPairs({
          Date: date,
          Summary: summary,
          ...(opts.detail ? { Detail: opts.detail } : {}),
          ...(opts.source ? { Source: opts.source } : {}),
        })
      );
    } else {
      console.log("Timeline entry was not created.");
    }
  } catch (err) {
    handleError(err, opts);
  }
}
