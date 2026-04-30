/**
 * Centralized error handling for the Brainbase CLI.
 *
 * Catches Brainbase SDK errors, network errors, config errors,
 * and prints user-friendly messages. Never leaks API keys.
 */

import chalk from "chalk";
import { BrainbaseError } from "brainbase-sdk";
import { GlobalOptions } from "../types.js";

export function handleError(err: unknown, opts: GlobalOptions): never {
  if (opts.json) {
    console.log(
      JSON.stringify({
        error: true,
        message: getSafeMessage(err),
        ...(err instanceof BrainbaseError ? { code: err.code } : {}),
      })
    );
  } else {
    console.error(chalk.red(`✗ ${getSafeMessage(err)}`));

    if (!opts.quiet && err instanceof BrainbaseError && err.code === 401) {
      console.error(
        chalk.gray(
          "  Hint: Check your BRAINBASE_API_KEY environment variable."
        )
      );
    }
    if (!opts.quiet && err instanceof Error && err.name === "ConfigError") {
      console.error(
        chalk.gray(
          "  Hint: Set BRAINBASE_URL and BRAINBASE_API_KEY in your environment."
        )
      );
    }
  }

  process.exit(1);
}

/** Extract a safe message, scrubbing any potential API key leaks */
function getSafeMessage(err: unknown): string {
  let message = "Unknown error";

  if (err instanceof BrainbaseError) {
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  // Scrub API keys from error messages before displaying
  return message.replace(/\b(bb_(live|test)_)[a-zA-Z0-9_]+/g, "[REDACTED]");
}

/** Wrap a function with CLI error handling */
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  opts: GlobalOptions
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((err: unknown) => handleError(err, opts));
      }
      return result;
    } catch (err) {
      handleError(err, opts);
    }
  }) as T;
}
