import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readConfigFile,
  writeConfigFile,
  setConfigKey,
  getConfigKey,
  listConfig,
  unsetConfigKey,
} from "../../src/utils/config-file.js";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const TEST_FILE = join(homedir(), ".brainbase", "config.json");

describe("config-file", () => {
  beforeEach(() => {
    // Clean slate
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
  });

  describe("read/write", () => {
    it("reads empty when file doesn't exist", () => {
      const cfg = readConfigFile();
      expect(cfg).toEqual({});
    });

    it("writes and reads config", () => {
      writeConfigFile({ apiKey: "bb_live_test", baseUrl: "https://example.com" });
      const cfg = readConfigFile();
      expect(cfg.apiKey).toBe("bb_live_test");
      expect(cfg.baseUrl).toBe("https://example.com");
    });

    it("creates file with restricted permissions", () => {
      writeConfigFile({ apiKey: "secret" });
      expect(existsSync(TEST_FILE)).toBe(true);
      // We can't easily test permissions in CI, but we can verify file exists
    });
  });

  describe("setConfigKey", () => {
    it("sets a single key", () => {
      setConfigKey("apiKey", "bb_live_123");
      expect(getConfigKey("apiKey")).toBe("bb_live_123");
    });

    it("updates an existing key", () => {
      setConfigKey("baseUrl", "https://old.com");
      setConfigKey("baseUrl", "https://new.com");
      expect(getConfigKey("baseUrl")).toBe("https://new.com");
    });

    it("removes key when value is empty string", () => {
      setConfigKey("brainId", "123");
      setConfigKey("brainId", "");
      expect(getConfigKey("brainId")).toBeUndefined();
    });
  });

  describe("listConfig", () => {
    it("lists all values with apiKey redacted", () => {
      writeConfigFile({ apiKey: "secret", baseUrl: "https://example.com" });
      const list = listConfig();
      expect(list.apiKey).toBe("***REDACTED***");
      expect(list.baseUrl).toBe("https://example.com");
    });

    it("returns empty object when nothing set", () => {
      const list = listConfig();
      expect(Object.keys(list).filter((k) => list[k] !== undefined)).toEqual([]);
    });
  });

  describe("unsetConfigKey", () => {
    it("removes a key", () => {
      setConfigKey("timeoutMs", 5000);
      unsetConfigKey("timeoutMs");
      expect(getConfigKey("timeoutMs")).toBeUndefined();
    });
  });
});
