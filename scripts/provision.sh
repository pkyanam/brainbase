#!/usr/bin/env bash
# Brainbase — zero-friction provisioning installer.
#
# Usage:
#   curl -fsSL https://brainbase.belweave.ai/api/provision/install | sh
#
# What it does:
#   1. Calls POST <BASE>/api/provision and parses the response.
#   2. Writes ~/.brainbase/config.json with { brain_id, api_key, url, mcp_url }.
#   3. Prints the API key once. The key is non-retrievable.
#   4. Optionally writes a sample MCP config under ~/.brainbase/mcp.json.
#
# Designed to be safe to pipe into sh — no sudo, no system writes outside
# the user's home directory, no installs of additional binaries.

set -eu

BASE="${BRAINBASE_URL:-https://brainbase.belweave.ai}"
NAME="${BRAINBASE_NAME:-}"
AGENT="${BRAINBASE_AGENT:-}"
CONFIG_DIR="${BRAINBASE_CONFIG_DIR:-$HOME/.brainbase}"

# ── Pretty output ─────────────────────────────────────────────
if [ -t 1 ]; then
  bold=$(printf '\033[1m')
  green=$(printf '\033[32m')
  red=$(printf '\033[31m')
  reset=$(printf '\033[0m')
else
  bold='' ; green='' ; red='' ; reset=''
fi

err() { printf '%s%s%s\n' "$red" "$1" "$reset" >&2; exit 1; }
ok()  { printf '%s%s%s\n' "$green" "$1" "$reset"; }

# ── Dependency check ──────────────────────────────────────────
command -v curl >/dev/null 2>&1 || err "curl is required"
JQ_OK=1
command -v jq   >/dev/null 2>&1 || JQ_OK=0

# ── Provision ─────────────────────────────────────────────────
printf '%sProvisioning a brain at %s ...%s\n' "$bold" "$BASE" "$reset"

BODY="{}"
[ -n "$NAME" ]  && BODY=$(printf '{"name":"%s"}' "$NAME")
[ -n "$AGENT" ] && BODY=$(printf '{"name":"%s","agent":"%s"}' "${NAME:-Agent Brain}" "$AGENT")

RESPONSE=$(curl -fsSL -X POST "$BASE/api/provision" \
  -H "Content-Type: application/json" \
  -d "$BODY") || err "Failed to reach $BASE/api/provision"

# ── Extract fields ────────────────────────────────────────────
if [ "$JQ_OK" -eq 1 ]; then
  BRAIN_ID=$(printf '%s' "$RESPONSE" | jq -r '.brain_id')
  API_KEY=$(printf '%s'  "$RESPONSE" | jq -r '.api_key')
  URL=$(printf '%s'      "$RESPONSE" | jq -r '.url')
  MCP_URL=$(printf '%s'  "$RESPONSE" | jq -r '.mcp_url')
  WIKI_URL=$(printf '%s' "$RESPONSE" | jq -r '.wiki_url')
else
  # POSIX-ish JSON extraction — works for the flat response we control
  extract() { printf '%s' "$1" | sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"; }
  BRAIN_ID=$(extract "$RESPONSE" "brain_id")
  API_KEY=$(extract  "$RESPONSE" "api_key")
  URL=$(extract      "$RESPONSE" "url")
  MCP_URL=$(extract  "$RESPONSE" "mcp_url")
  WIKI_URL=$(extract "$RESPONSE" "wiki_url")
fi

[ -n "$BRAIN_ID" ] || err "Provisioning succeeded but no brain_id in response"
[ -n "$API_KEY"  ] || err "Provisioning succeeded but no api_key in response"

# ── Persist config ────────────────────────────────────────────
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
cat >"$CONFIG_DIR/config.json" <<EOF
{
  "brain_id": "$BRAIN_ID",
  "api_key":  "$API_KEY",
  "url":      "$URL",
  "mcp_url":  "$MCP_URL",
  "wiki_url": "$WIKI_URL"
}
EOF
chmod 600 "$CONFIG_DIR/config.json"

cat >"$CONFIG_DIR/mcp.json" <<EOF
{
  "mcpServers": {
    "brainbase": {
      "url": "$MCP_URL",
      "transport": "http",
      "headers": { "Authorization": "Bearer $API_KEY" }
    }
  }
}
EOF
chmod 600 "$CONFIG_DIR/mcp.json"

# ── Report ────────────────────────────────────────────────────
ok "Brain provisioned."
printf '\n  %sbrain_id:%s %s\n'   "$bold" "$reset" "$BRAIN_ID"
printf '  %sapi_key:%s  %s\n'    "$bold" "$reset" "$API_KEY"
printf '  %surl:%s      %s\n'    "$bold" "$reset" "$URL"
printf '  %smcp:%s      %s\n'    "$bold" "$reset" "$MCP_URL"
printf '  %swiki:%s     %s\n\n'  "$bold" "$reset" "$WIKI_URL"
printf 'Saved to %s%s/config.json%s and %s%s/mcp.json%s\n\n' \
  "$bold" "$CONFIG_DIR" "$reset" "$bold" "$CONFIG_DIR" "$reset"
printf '%sThe API key is shown once and not retrievable. Treat it like a password.%s\n' "$bold" "$reset"
