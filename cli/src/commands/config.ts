/**
 * Config command — manage persistent CLI settings.
 *
 * Stores settings in ~/.brainbase/config.json with restricted permissions.
 */

import { GlobalOptions } from "../types.js";
import {
  setConfigKey,
  getConfigKey,
  listConfig,
  unsetConfigKey,
  PersistentConfig,
} from "../utils/config-file.js";
import chalk from "chalk";

export async function configSetCommand(
  key: keyof PersistentConfig,
  value: string,
  _opts: GlobalOptions
): Promise<void> {
  // Parse numbers for timeoutMs
  let parsedValue: string | number = value;
  if (key === "timeoutMs") {
    const num = parseInt(value, 10);
    if (Number.isNaN(num) || num < 1) {
      console.error(chalk.red(`✗ Invalid timeout: ${value}`));
      process.exit(1);
    }
    parsedValue = num;
  }

  setConfigKey(key, parsedValue as any);
  const displayValue = key === "apiKey" ? "***REDACTED***" : parsedValue;
  console.log(chalk.green(`✓ Set ${key} = ${displayValue}`));
}

export async function configGetCommand(
  key: keyof PersistentConfig,
  _opts: GlobalOptions
): Promise<void> {
  const value = getConfigKey(key);
  if (value === undefined) {
    console.log(chalk.yellow(`${key} is not set`));
    return;
  }
  const displayValue = key === "apiKey" ? "***REDACTED***" : value;
  console.log(`${key} = ${displayValue}`);
}

export async function configListCommand(_opts: GlobalOptions): Promise<void> {
  const cfg = listConfig();
  const entries = Object.entries(cfg).filter(([_, v]) => v !== undefined);

  if (entries.length === 0) {
    console.log("No config values set.");
    console.log(chalk.gray("Run: brainbase config set <key> <value>"));
    return;
  }

  const maxKey = Math.max(...entries.map(([k]) => k.length));
  console.log(chalk.bold("Config (~/.brainbase/config.json):"));
  for (const [k, v] of entries) {
    console.log(`  ${k.padEnd(maxKey)}  ${v}`);
  }
}

export async function configUnsetCommand(
  key: keyof PersistentConfig,
  _opts: GlobalOptions
): Promise<void> {
  unsetConfigKey(key);
  console.log(chalk.green(`✓ Unset ${key}`));
}
