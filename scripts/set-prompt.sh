#!/usr/bin/env bash
set -euo pipefail

PROMPT_FILE="$(dirname "$0")/../prompt.txt"
ENV_FILE="$(dirname "$0")/../supabase/functions/.env"

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: prompt.txt not found at $PROMPT_FILE"
  exit 1
fi

ENCODED=$(base64 -i "$PROMPT_FILE" | tr -d '\n')

# --- Local ---
if [ -f "$ENV_FILE" ]; then
  # Update existing line if present, otherwise append
  if grep -q "^SCORING_PROMPT=" "$ENV_FILE"; then
    sed -i '' "s|^SCORING_PROMPT=.*|SCORING_PROMPT=$ENCODED|" "$ENV_FILE"
  else
    echo "SCORING_PROMPT=$ENCODED" >> "$ENV_FILE"
  fi
else
  echo "SCORING_PROMPT=$ENCODED" > "$ENV_FILE"
fi
echo "✓ Local env updated ($ENV_FILE)"

# --- Production ---
supabase secrets set SCORING_PROMPT="$ENCODED"
echo "✓ Supabase secret updated"
