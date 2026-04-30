/**
 * Configuration loader for the Brainbase CLI.
 *
 * Reads from environment variables and validates required fields.
 * Security: never logs the API key.
 */

import { CliConfig } from "../types.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_BASE_URL = "http://localhost:5174";

/** Environment variable names */
export const ENV = {
  BASE_URL: "BRAINBASE_URL",
  API_KEY: "BRAINBASE_API_KEY",
  BRAIN_ID: "BRAINBASE_BRAIN_ID",
  TIMEOUT: "BRAINBASE_TIMEOUT_MS",
} as const;

/** Load configuration from environment variables */
export function loadConfig(): CliConfig {
  const baseUrl = process.env[ENV.BASE_URL]?.trim() || DEFAULT_BASE_URL;
  const apiKey = process.env[ENV.API_KEY]?.trim() || "";
  const brainId = process.env[ENV.BRAIN_ID]?.trim() || undefined;
  const timeoutMs = parseInt(process.env[ENV.TIMEOUT]?.trim() || String(DEFAULT_TIMEOUT_MS), 10);

  if (Number.isNaN(timeoutMs) || timeoutMs < 1) {
    throw new ConfigError(
      `Invalid timeout: ${process.env[ENV.TIMEOUT]}. Must be a positive integer (ms).`
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    brainId,
    timeoutMs,
  };
}

/**
 * Build a Brainbase SDK config object.
 * The SDK requires an API key, but the CLI allows localhost without one.
 */
export function buildSdkConfig(
  cliConfig: CliConfig,
  overrides: { brainId?: string } = {}
): { apiKey: string; baseUrl: string; timeoutMs: number; brainId?: string } {
  const effectiveBrainId = overrides.brainId ?? cliConfig.brainId;

  return {
    apiKey: cliConfig.apiKey,
    baseUrl: cliConfig.baseUrl,
    timeoutMs: cliConfig.timeoutMs,
    ...(effectiveBrainId ? { brainId: effectiveBrainId } : {}),
  };
}

/** Validate that an API key is present for non-localhost URLs */
export function requireApiKey(config: CliConfig): void {
  const isLocalhost = /^(http:\/\/localhost|http:\/\/127\.0\.0\.1)/i.test(config.baseUrl);
  if (!config.apiKey && !isLocalhost) {
    throw new ConfigError(
      `API key is required for remote endpoints.\n` +
        `Set ${ENV.API_KEY} in your environment or use a localhost URL.`
    );
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
