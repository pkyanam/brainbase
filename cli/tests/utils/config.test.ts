import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadConfig,
  buildSdkConfig,
  requireApiKey,
  ConfigError,
  ENV,
} from "../../src/utils/config.js";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env[ENV.BASE_URL];
    delete process.env[ENV.API_KEY];
    delete process.env[ENV.BRAIN_ID];
    delete process.env[ENV.TIMEOUT];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("loadConfig", () => {
    it("returns defaults when no env vars are set", () => {
      const config = loadConfig();
      expect(config.baseUrl).toBe("http://localhost:5174");
      expect(config.apiKey).toBe("");
      expect(config.brainId).toBeUndefined();
      expect(config.timeoutMs).toBe(30_000);
    });

    it("reads all env vars correctly", () => {
      process.env[ENV.BASE_URL] = "https://brainbase.belweave.ai";
      process.env[ENV.API_KEY] = "bb_live_test123";
      process.env[ENV.BRAIN_ID] = "brain-uuid-123";
      process.env[ENV.TIMEOUT] = "10000";

      const config = loadConfig();
      expect(config.baseUrl).toBe("https://brainbase.belweave.ai");
      expect(config.apiKey).toBe("bb_live_test123");
      expect(config.brainId).toBe("brain-uuid-123");
      expect(config.timeoutMs).toBe(10_000);
    });

    it("allows CLI overrides for apiKey and brainId", () => {
      process.env[ENV.API_KEY] = "env_key";
      process.env[ENV.BRAIN_ID] = "env_brain";

      const config = loadConfig({ apiKey: "cli_key", brainId: "cli_brain" });
      expect(config.apiKey).toBe("cli_key");
      expect(config.brainId).toBe("cli_brain");
    });

    it("falls back to env when no overrides provided", () => {
      process.env[ENV.API_KEY] = "env_key";
      process.env[ENV.BRAIN_ID] = "env_brain";

      const config = loadConfig();
      expect(config.apiKey).toBe("env_key");
      expect(config.brainId).toBe("env_brain");
    });

    it("strips trailing slash from baseUrl", () => {
      process.env[ENV.BASE_URL] = "https://api.example.com/";
      const config = loadConfig();
      expect(config.baseUrl).toBe("https://api.example.com");
    });

    it("throws ConfigError for invalid timeout", () => {
      process.env[ENV.TIMEOUT] = "not-a-number";
      expect(() => loadConfig()).toThrow(ConfigError);
    });

    it("throws ConfigError for negative timeout", () => {
      process.env[ENV.TIMEOUT] = "-1";
      expect(() => loadConfig()).toThrow(ConfigError);
    });

    it("trims whitespace from values", () => {
      process.env[ENV.API_KEY] = "  bb_live_key  ";
      const config = loadConfig();
      expect(config.apiKey).toBe("bb_live_key");
    });
  });

  describe("buildSdkConfig", () => {
    it("passes through all values", () => {
      const config = {
        baseUrl: "https://api.example.com",
        apiKey: "bb_live_key",
        brainId: "brain-123",
        timeoutMs: 5000,
      };
      const sdk = buildSdkConfig(config);
      expect(sdk).toEqual({
        baseUrl: "https://api.example.com",
        apiKey: "bb_live_key",
        timeoutMs: 5000,
        brainId: "brain-123",
      });
    });

    it("allows brainId override", () => {
      const config = {
        baseUrl: "https://api.example.com",
        apiKey: "bb_live_key",
        brainId: "brain-123",
        timeoutMs: 5000,
      };
      const sdk = buildSdkConfig(config, { brainId: "override-456" });
      expect(sdk.brainId).toBe("override-456");
    });

    it("omits brainId when not set", () => {
      const config = {
        baseUrl: "https://api.example.com",
        apiKey: "bb_live_key",
        timeoutMs: 5000,
      };
      const sdk = buildSdkConfig(config);
      expect(sdk.brainId).toBeUndefined();
    });
  });

  describe("requireApiKey", () => {
    it("does not throw for localhost", () => {
      const config = {
        baseUrl: "http://localhost:5174",
        apiKey: "",
        timeoutMs: 30000,
      };
      expect(() => requireApiKey(config)).not.toThrow();
    });

    it("does not throw for 127.0.0.1", () => {
      const config = {
        baseUrl: "http://127.0.0.1:3000",
        apiKey: "",
        timeoutMs: 30000,
      };
      expect(() => requireApiKey(config)).not.toThrow();
    });

    it("throws for remote URL without API key", () => {
      const config = {
        baseUrl: "https://api.example.com",
        apiKey: "",
        timeoutMs: 30000,
      };
      expect(() => requireApiKey(config)).toThrow(ConfigError);
    });

    it("does not throw when API key is present", () => {
      const config = {
        baseUrl: "https://api.example.com",
        apiKey: "bb_live_key",
        timeoutMs: 30000,
      };
      expect(() => requireApiKey(config)).not.toThrow();
    });
  });
});
