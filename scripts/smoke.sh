#!/usr/bin/env bash
set -euo pipefail
BASE="http://localhost:8080"
USER="cmg99oq140000t88wx9u8gcix"

echo "=== health ==="
curl -s ${BASE}/v1/health; echo

echo "=== db.ping ==="
curl -s ${BASE}/v1/db/ping; echo

echo "=== jd.parse ==="
curl -s -X POST ${BASE}/v1/jd/parse -H "Content-Type: application/json" \
  -d '{"raw_text":"3?飬SQL/ExcelTableau?Э"}'; echo

echo "=== match.score ==="
curl -s -X POST ${BASE}/v1/match/score -H "Content-Type: application/json" \
  -d '{"jd_text":"3?飬SQL/ExcelTableau"}'; echo

echo "=== analysis.report ==="
curl -s -X POST ${BASE}/v1/analysis/report -H "Content-Type: application/json" \
  -d '{"analysis":{"match_score":57,"hits":["SQL","Excel"],"gaps":["Tableau"]}}'; echo

echo "=== order.create / callback / status ==="
OC=$(curl -s -X POST ${BASE}/v1/order/create -H "Content-Type: application/json" \
  -d '{"plan":"basic","amount":1990}')
echo "$OC"
OTN=$(echo "$OC" | sed -n 's/.*"out_trade_no":"\([^"]*\)".*/\1/p')
curl -s -X POST ${BASE}/v1/order/callback -H "Content-Type: application/json" \
  -d "{\"out_trade_no\":\"${OTN}\",\"result\":\"SUCCESS\",\"amount\":1990}"; echo
curl -s "${BASE}/v1/order/status?out_trade_no=${OTN}"; echo

echo "=== render.pdf ==="
curl -s -X POST ${BASE}/v1/render/pdf -H "Content-Type: application/json" \
  -d '{"html":"<div style=\"font-size:24px\">Smoke Test PDF</div>"}'; echo

echo "=== render.resume ==="
RESUME_RESP=$(curl -s -X POST ${BASE}/v1/render/resume -H "Content-Type: application/json" \
  -d '{"templateId":"classic"}')
echo "$RESUME_RESP"
FILE_ID=$(node -e 'const raw = process.argv[2]; try { const obj = JSON.parse(raw); const id = obj?.data?.file_id; if (!id) process.exit(1); process.stdout.write(id); } catch (e) { process.exit(1); }' "--" "$RESUME_RESP") || {
  echo "$RESUME_RESP"
  echo "Failed to parse render.resume response"
  exit 1
}

echo "=== file.download ==="
DOWNLOAD_RESP=$(curl -s "${BASE}/v1/file/download?file_id=${FILE_ID}")
echo "$DOWNLOAD_RESP"
SIGNED_URL=$(node -e 'const raw = process.argv[2]; try { const obj = JSON.parse(raw); const url = obj?.data?.url; if (!url) process.exit(1); process.stdout.write(url); } catch (e) { process.exit(1); }' "--" "$DOWNLOAD_RESP") || {
  echo "$DOWNLOAD_RESP"
  echo "Failed to parse file.download response"
  exit 1
}

TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT
if ! curl -fsSL "$SIGNED_URL" -o "$TMP_FILE"; then
  echo "$DOWNLOAD_RESP"
  echo "Download failed"
  exit 1
fi

if [ ! -s "$TMP_FILE" ]; then
  echo "$DOWNLOAD_RESP"
  echo "Downloaded file is empty"
  exit 1
fi

DOWNLOAD_BYTES=$(wc -c < "$TMP_FILE")
echo "download.bytes=${DOWNLOAD_BYTES}"

echo "=== results.save(DB) ==="
curl -s -X POST ${BASE}/v1/results/save -H "Content-Type: application/json" \
  -d "{\"user_id\":\"${USER}\",\"match\":{\"match_score\":30},\"report\":{\"radar\":{\"hard\":30}},\"file\":{\"file_id\":\"x.pdf\",\"bytes\":12345}}"; echo

echo "=== results.db(list) ==="
curl -s "${BASE}/v1/results/db?user_id=${USER}"; echo
