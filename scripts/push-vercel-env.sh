#!/usr/bin/env bash
# Push env from .env.vercel into the linked Vercel project (Production + Preview).
# Prerequisites: `vercel login` and `vercel link` in the repo root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.vercel}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.local and set APP_ENV=staging, APP_BASE_URL=https://YOUR.vercel.app, META_GRAPH_API_BASE_URL=https://graph.facebook.com" >&2
  exit 1
fi
if ! vercel whoami >/dev/null 2>&1; then
  echo "Run: vercel login" >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  [[ -z "$key" ]] && continue
  # Skip empty optional
  if [[ -z "$val" && "$key" == "LLM_BASE_URL" ]]; then
    continue
  fi
  echo "Setting $key …"
  printf '%s' "$val" | vercel env add "$key" production --force >/dev/null
  printf '%s' "$val" | vercel env add "$key" preview --force >/dev/null
done < "$ENV_FILE"

echo "Done. Redeploy: vercel --prod"
echo "Then set Meta App domains to the host of APP_BASE_URL (no https://)."
