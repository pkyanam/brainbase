/**
 * Shared types for the Brainbase CLI.
 */

export interface CliConfig {
  /** Brainbase API endpoint URL */
  baseUrl: string;
  /** API authentication key */
  apiKey: string;
  /** Default brain ID for multi-tenant setups */
  brainId?: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
}

export interface GlobalOptions {
  /** Override the default brain ID */
  brainId?: string;
  /** Output raw JSON instead of formatted text */
  json?: boolean;
  /** Suppress non-error output */
  quiet?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}
