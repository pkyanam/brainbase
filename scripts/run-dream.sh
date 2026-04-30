#!/bin/bash
# Brainbase Dream Cycle runner — sources env and executes
set -e
cd "$(dirname "$0")/.."
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi
npx tsx scripts/dream-cycle.ts 00000000-0000-0000-0000-000000000001 2>&1
