/**
 * Put-page command — create or update a page.
 */

import { Brainbase } from "brainbase-sdk";
import { CliConfig, GlobalOptions } from "../types.js";
import { output, success, formatPairs } from "../utils/format.js";
import { handleError } from "../utils/errors.js";
import { buildSdkConfig, requireApiKey } from "../utils/config.js";

export interface PutPageOptions extends GlobalOptions {
  type?: string;
  content?: string;
  writtenBy?: string;
}

export async function putPageCommand(
  slug: string,
  title: string,
  config: CliConfig,
  opts: PutPageOptions
): Promise<void> {
  try {
    requireApiKey(config);

    const sdkConfig = buildSdkConfig(config, { brainId: opts.brainId });
    const brain = new Brainbase(sdkConfig);

    const result = await brain.putPage({
      slug,
      title,
      type: opts.type,
      content: opts.content,
      written_by: opts.writtenBy,
    });

    if (opts.json) {
      output(result, opts);
      return;
    }

    const isNew = result?.created_at === result?.updated_at;
    success(`Page ${slug} ${isNew ? "created" : "updated"}`, opts);

    if (result) {
      console.log(
        formatPairs({
          Title: result.title,
          Type: result.type,
          Slug: result.slug,
        })
      );
    }
  } catch (err) {
    handleError(err, opts);
  }
}
