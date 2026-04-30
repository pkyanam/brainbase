/**
 * Persistent config file manager for the Brainbase CLI.
 *
 * Stores settings in ~/.brainbase/config.json with restricted permissions.
 * Security: API keys are never logged. File is created with 0o600.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".brainbase");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const FILE_MODE = 0o600; // owner read/write only

export interface PersistentConfig {
  baseUrl?: string;
  apiKey?: string;
  brainId?: string;
  timeoutMs?: number;
}

/** Read the persistent config file if it exists */
export function readConfigFile(): PersistentConfig {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as PersistentConfig;
  } catch {
    return {};
  }
}

/** Write the persistent config file with restricted permissions */
export function writeConfigFile(config: PersistentConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: FILE_MODE });
  // Ensure permissions even if umask is loose
  chmodSync(CONFIG_FILE, FILE_MODE);
}

/** Set a single key in the config file */
export function setConfigKey<K extends keyof PersistentConfig>(
  key: K,
  value: PersistentConfig[K]
): void {
  const current = readConfigFile();
  if (value === undefined || value === null || value === "") {
    delete current[key];
  } else {
    current[key] = value;
  }
  writeConfigFile(current);
}

/** Get a single key from the config file */
export function getConfigKey<K extends keyof PersistentConfig>(
  key: K
): PersistentConfig[K] | undefined {
  return readConfigFile()[key];
}

/** List all non-sensitive config values (hides apiKey) */
export function listConfig(): Record<string, string | number | undefined> {
  const cfg = readConfigFile();
  return {
    baseUrl: cfg.baseUrl,
    brainId: cfg.brainId,
    timeoutMs: cfg.timeoutMs,
    apiKey: cfg.apiKey ? "***REDACTED***" : undefined,
  };
}

/** Remove a key from the config file */
export function unsetConfigKey<K extends keyof PersistentConfig>(key: K): void {
  const current = readConfigFile();
  delete current[key];
  writeConfigFile(current);
}
