import { describe, it, expect, vi } from "vitest";
import { handleError, withErrorHandling } from "../../src/utils/errors.js";
import { BrainbaseError } from "brainbase-sdk";
import { GlobalOptions } from "../../src/types.js";

describe("errors", () => {
  const baseOpts: GlobalOptions = { json: false, quiet: false, verbose: false };
  const jsonOpts: GlobalOptions = { json: true, quiet: false, verbose: false };

  describe("handleError", () => {
    it("prints error message in normal mode", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exit");
      });

      try {
        handleError(new Error("Something broke"), baseOpts);
      } catch {
        // expected
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Something broke"));
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("prints JSON in json mode", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exit");
      });

      try {
        handleError(new BrainbaseError("Auth failed", 401), jsonOpts);
      } catch {
        // expected
      }

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Auth failed")
      );
      exitSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("scrubs API keys from error messages", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exit");
      });

      try {
        handleError(new Error("Invalid key: bb_live_secret123abc"), baseOpts);
      } catch {
        // expected
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[REDACTED]")
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("bb_live_secret123abc")
      );
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("shows hint for 401 errors", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exit");
      });

      try {
        handleError(new BrainbaseError("Unauthorized", 401), baseOpts);
      } catch {
        // expected
      }

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe("withErrorHandling", () => {
    it("wraps sync functions", () => {
      const fn = vi.fn(() => "result");
      const wrapped = withErrorHandling(fn, baseOpts);
      expect(wrapped()).toBe("result");
    });

    it("catches sync errors", () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exit");
      });
      const fn = vi.fn(() => {
        throw new Error("boom");
      });
      const wrapped = withErrorHandling(fn, baseOpts);

      expect(() => wrapped()).toThrow("exit");
      exitSpy.mockRestore();
    });

    it("catches async errors", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exit");
      });
      const fn = vi.fn(async () => {
        throw new Error("async boom");
      });
      const wrapped = withErrorHandling(fn, baseOpts);

      await expect(wrapped()).rejects.toThrow("exit");
      exitSpy.mockRestore();
    });
  });
});
