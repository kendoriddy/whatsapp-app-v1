#!/usr/bin/env bash
# Prints Meta webhook values for the current deploy. Do not commit secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN="$(grep -E '^META_WEBHOOK_VERIFY_TOKEN=' "$ROOT/.env.local" | cut -d= -f2-)"
BASE="${APP_BASE_URL:-}"
if [[ -z "$BASE" && -f "$ROOT/.env.vercel" ]]; then
  BASE="$(grep -E '^APP_BASE_URL=' "$ROOT/.env.vercel" | cut -d= -f2-)"
fi
if [[ -z "$BASE" ]]; then
  echo "Set APP_BASE_URL or put it in .env.vercel" >&2
  exit 1
fi
echo "Callback URL:"
echo "  ${BASE%/}/api/webhooks/whatsapp"
echo
echo "Verify token:"
echo "  $TOKEN"
echo
echo "Smoke test:"
echo "  curl -sS \"${BASE%/}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=1158201444\""
echo
echo "Subscribe WABA fields: messages, message_template_status_update,"
echo "  phone_number_quality_update, phone_number_name_update,"
echo "  account_update, account_review_update, business_capability_update"
echo
echo "Then Publish the Meta app (Development mode blocks real customer inbound)."
