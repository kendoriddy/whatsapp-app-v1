#!/usr/bin/env bash
# Register a Cloud API phone number. Requires PHONE_NUMBER_ID, TOKEN, and PIN.
# Usage:
#   PHONE_NUMBER_ID=... TOKEN=... PIN=123456 ./scripts/register-wa-number.sh
set -euo pipefail
VERSION="${META_GRAPH_API_VERSION:-v25.0}"
: "${PHONE_NUMBER_ID:?Set PHONE_NUMBER_ID}"
: "${TOKEN:?Set TOKEN (temporary API Setup token or permanent system-user token)}"
: "${PIN:?Set PIN (6 digits; keep offline — never commit)}"

curl -sS -X POST "https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/register" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"pin\":\"${PIN}\"}"
echo
curl -sS "https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,status,platform_type,quality_rating" \
  -H "Authorization: Bearer ${TOKEN}"
echo
