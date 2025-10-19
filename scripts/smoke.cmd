@echo off
chcp 65001 >NUL
setlocal ENABLEDELAYEDEXPANSION
set "BASE=http://localhost:8080"
set "USER=cmg99oq140000t88wx9u8gcix"

echo === health ===
curl -s "%BASE%/v1/health" & echo.

echo === db.ping ===
curl -s "%BASE%/v1/db/ping" & echo.

echo === jd.parse ===
curl -s -X POST "%BASE%/v1/jd/parse" -H "Content-Type: application/json" -d "{\"raw_text\":\"3+years experience, proficient in SQL/Excel, familiar with Tableau, good communication\"}" & echo.

echo === match.score ===
curl -s -X POST "%BASE%/v1/match/score" -H "Content-Type: application/json" -d "{\"jd_text\":\"3 years experience, SQL Excel Tableau\"}" & echo.

echo === analysis.report ===
curl -s -X POST "%BASE%/v1/analysis/report" -H "Content-Type: application/json" -d "{\"analysis\":{\"match_score\":57,\"hits\":[\"SQL\",\"Excel\"],\"gaps\":[\"Tableau\"]}}" & echo.

echo === order.create / callback / status ===
for /f "usebackq delims=" %%O in (`powershell -NoLogo -NoProfile -Command "$r=Invoke-RestMethod -Uri '%BASE%/v1/order/create' -Method Post -ContentType 'application/json' -Body '{\"plan\":\"basic\",\"amount\":1990}'; $r.data.out_trade_no"`) do set "OTN=%%O"
echo out_trade_no=%OTN%
set "_WXPAY_SIG=%WXPAY_FAKE_CALLBACK_SIGNATURE%"
if "%_WXPAY_SIG%"=="" set "_WXPAY_SIG=wxpay-fake-signature"
curl -s -X POST "%BASE%/v1/order/callback" -H "Content-Type: application/json" -H "Wechatpay-Signature: %_WXPAY_SIG%" -d "{\"out_trade_no\":\"%OTN%\",\"result\":\"SUCCESS\",\"amount\":1990}" & echo.
curl -s -X POST "%BASE%/v1/order/callback" -H "Content-Type: application/json" -H "Wechatpay-Signature: %_WXPAY_SIG%" -d "{\"out_trade_no\":\"%OTN%\",\"result\":\"SUCCESS\",\"amount\":1990}" & echo.
curl -s "%BASE%/v1/order/status?out_trade_no=%OTN%" & echo.

echo === render.pdf ===
set "TMP_RENDER=%TEMP%\wxresume-render-%RANDOM%.pdf"
curl -s -o "%TMP_RENDER%" -w "status=%{http_code} bytes=%{size_download}\n" ^
  -X POST "%BASE%/v1/render/pdf?templateId=modern" ^
  -H "Content-Type: application/json" ^
  -d "{\"resume\":{\"basics\":{\"name\":\"Smoke 用户\",\"label\":\"QA\",\"email\":\"qa@example.com\"},\"skills\":[{\"name\":\"验证\",\"keywords\":[\"脚本\",\"报告\"]}]}}"
for %%I in ("%TMP_RENDER%") do set "RENDER_SIZE=%%~zI"
if not defined RENDER_SIZE set "RENDER_SIZE=0"
echo render.pdf.bytes=%RENDER_SIZE%
del /f /q "%TMP_RENDER%" >NUL 2>&1

set "FILE_ID=resume-demo.pdf"

echo === file.download ===
set "DOWNLOAD_RESP="
set "SIGNED_URL="
for /f "usebackq tokens=1* delims=|" %%A in (`powershell -NoLogo -NoProfile -Command "$resp=Invoke-RestMethod -Uri '%BASE%/v1/file/download?file_id=%FILE_ID%'; $json=$resp | ConvertTo-Json -Compress; Write-Output ('JSON|' + $json); Write-Output ('URL|' + $resp.data.url)"`) do (
  if "%%A"=="JSON" set "DOWNLOAD_RESP=%%B"
  if "%%A"=="URL" set "SIGNED_URL=%%B"
)
echo !DOWNLOAD_RESP!
if not defined SIGNED_URL (
  echo !DOWNLOAD_RESP!
  echo Failed to parse file.download response
  exit /b 1
)

set "TMPFILE=%TEMP%\wxresume-smoke-download.tmp"
curl -s -f -L "!SIGNED_URL!" -o "!TMPFILE!"
if errorlevel 1 (
  echo !DOWNLOAD_RESP!
  echo Download failed
  del /f /q "!TMPFILE!" >NUL 2>&1
  exit /b 1
)

set "DOWNLOAD_SIZE="
for %%I in ("!TMPFILE!") do set "DOWNLOAD_SIZE=%%~zI"
if not defined DOWNLOAD_SIZE set "DOWNLOAD_SIZE=0"
if "!DOWNLOAD_SIZE!"=="0" (
  echo !DOWNLOAD_RESP!
  echo Downloaded file is empty
  del /f /q "!TMPFILE!" >NUL 2>&1
  exit /b 1
)

echo download.bytes=!DOWNLOAD_SIZE!
del /f /q "!TMPFILE!" >NUL 2>&1

echo === results.save(DB) ===
curl -s -X POST "%BASE%/v1/results/save" -H "Content-Type: application/json" -d "{\"user_id\":\"%USER%\",\"match\":{\"match_score\":30},\"report\":{\"radar\":{\"hard\":30}},\"file\":{\"file_id\":\"x.pdf\",\"bytes\":12345}}" & echo.

echo === results.db(list) ===
curl -s "%BASE%/v1/results/db?user_id=%USER%" & echo.

echo === DONE ===
endlocal
