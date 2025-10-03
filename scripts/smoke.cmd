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
curl -s -X POST "%BASE%/v1/order/callback" -H "Content-Type: application/json" -d "{\"out_trade_no\":\"%OTN%\",\"result\":\"SUCCESS\",\"amount\":1990}" & echo.
curl -s "%BASE%/v1/order/status?out_trade_no=%OTN%" & echo.

echo === render.pdf ===
powershell -NoLogo -NoProfile -Command "$b=@{html='<div style=\"font-size:24px\">Smoke Test PDF</div>'}|ConvertTo-Json; $r=Invoke-RestMethod -Uri '%BASE%/v1/render/pdf' -Method Post -ContentType 'application/json' -Body $b; $r | ConvertTo-Json -Compress" & echo.


echo === render.resume ===
curl -s -X POST "%BASE%/v1/render/resume" -H "Content-Type: application/json" -d "{\"templateId\":\"classic\"}" & echo.

echo === results.save(DB) ===
curl -s -X POST "%BASE%/v1/results/save" -H "Content-Type: application/json" -d "{\"user_id\":\"%USER%\",\"match\":{\"match_score\":30},\"report\":{\"radar\":{\"hard\":30}},\"file\":{\"file_id\":\"x.pdf\",\"bytes\":12345}}" & echo.

echo === results.db(list) ===
curl -s "%BASE%/v1/results/db?user_id=%USER%" & echo.

echo === DONE ===
endlocal
