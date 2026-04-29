/**
 * Lightweight MCP client over stdio — connects to the GBrain MCP server.
 * Used by Brainbase API routes to talk to the real GBrain backend.
 *
 * Protocol: JSON-RPC 2.0 over stdin/stdout
 * MCP lifecycle: initialize → initialized → tools/list | tools/call
 */
import { spawn, ChildProcess } from "child_process";
import { createInterface } from "readline";

const GBRAIN_SERVER_CMD = "/Users/preetham/.local/bin/gbrain-with-env";
const GBRAIN_SERVER_ARGS = ["serve"];

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface McpTextContent {
  type: "text";
  text: string;
}

interface McpToolResult {
  content: McpTextContent[];
  isError?: boolean;
}

let proc: ChildProcess | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let initialized = false;

function getProcess(): ChildProcess {
  if (proc && !proc.killed) return proc;

  proc = spawn(GBRAIN_SERVER_CMD, GBRAIN_SERVER_ARGS, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, HOME: process.env.HOME || "/Users/preetham" },
  });

  const rl = createInterface({ input: proc.stdout! });
  rl.on("line", (line: string) => {
    try {
      const msg: JsonRpcResponse = JSON.parse(line);
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);

      if (msg.error) {
        p.reject(new Error(msg.error.message));
      } else {
        p.resolve(msg.result);
      }
    } catch {
      // Skip non-JSON lines
    }
  });

  proc.stderr?.on("data", (d: Buffer) => {
    // Log stderr but don't crash — MCP sends logs here
    const s = d.toString().trim();
    if (s) console.error("[gbrain-mcp stderr]", s.slice(0, 200));
  });

  proc.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[gbrain-mcp] process exited with code ${code}`);
    }
    proc = null;
    initialized = false;
    // Reject all pending
    for (const [id, p] of pending) {
      p.reject(new Error("GBrain MCP process exited"));
      pending.delete(id);
    }
  });

  return proc;
}

function sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const id = nextId++;
  const req: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
  const p = getProcess();

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    p.stdin!.write(JSON.stringify(req) + "\n");

    // Timeout after 15s
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`MCP request ${method} timed out`));
      }
    }, 15000);
  });
}

async function initialize(): Promise<void> {
  if (initialized) return;

  const result = (await sendRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "brainbase", version: "0.2.0" },
  })) as { protocolVersion?: string };

  await sendRequest("notifications/initialized", {});
  initialized = true;
  console.log(
    `[gbrain-mcp] initialized, protocol=${result?.protocolVersion || "unknown"}`
  );
}

export async function callTool(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  await initialize();

  const result = (await sendRequest("tools/call", {
    name: toolName,
    arguments: args,
  })) as McpToolResult;

  if (result.isError) {
    throw new Error(result.content?.[0]?.text || "Unknown MCP tool error");
  }

  return result.content?.[0]?.text || "";
}

export async function callToolJson<T = unknown>(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const text = await callTool(toolName, args);
  try {
    return JSON.parse(text) as T;
  } catch {
    // Not JSON — return as-is
    return text as unknown as T;
  }
}

/** Clean up the MCP process (call on server shutdown) */
export function disconnect(): void {
  if (proc && !proc.killed) {
    proc.kill();
    proc = null;
    initialized = false;
  }
}
