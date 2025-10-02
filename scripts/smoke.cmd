@echo off
setlocal ENABLEDELAYEDEXPANSION
set BASE=http://localhost:8080
set USER=cmg99oq140000t88wx9u8gcix

echo === health ===
curl -s %BASE%/v1/health & echo.

echo === db.ping ===
curl -s %BASE%/v1/db/ping & echo.

echo === jd.parse ===
curl -s -X POST %BASE%/v1/jd/parse -H "Content-Type: application/json" -d "{\"raw_text\":\"3年以上经验，熟练SQL/Excel，了解Tableau，善于沟通协作\"}" & echo.

echo === match.score ===
curl -s -X POST %BASE%/v1/match/score -H "Content-Type: application/json" -d "{\"jd_text\":\"3年以上经验，熟练SQL/Excel，了解Tableau\"}" & echo.

echo === analysis.report ===
curl -s -X POST %BASE%/v1/analysis/report -H "Content-Type: application/json" -d "{\"analysis\":{\"match_score\":57,\"hits\":[\"SQL\",\"Excel\"],\"gaps\":[\"Tableau\"]}}" & echo.

echo === order.create ===
for /f "delims=" %%A in ('curl -s -X POST %BASE%/v1/order/create -H "Content-Type: application/json" -d "{\"plan\":\"basic\",\"amount\":1990}"') do set OC=%%A
echo %OC%
for /f "tokens=2 delims=:," %%B in ('echo %OC% ^| findstr /i "out_trade_no"') do set OTN=%%~B
set OTN=%OTN:"=%
set OTN=%OTN: =%

echo === order.callback -> paid ===
curl -s -X POST %BASE%/v1/order/callback -H "Content-Type: application/json" -d "{\"out_trade_no\":\"%OTN%\",\"result\":\"SUCCESS\",\"amount\":1990}" & echo.
echo === order.status ===
curl -s "%BASE%/v1/order/status?out_trade_no=%OTN%" & echo.

echo === render.pdf ===
curl -s -X POST %BASE%/v1/render/pdf -H "Content-Type: application/json" -d "{\"html\":\"<div style=\\\"font-size:24px\\\">你好，PDF</div>\"}" & echo.

echo === render.resume ===
curl -s -X POST %BASE%/v1/render/resume -H "Content-Type: application/json" -d "{\"templateId\":\"classic\"}" & echo.

echo === results.save(DB) ===
curl -s -X POST %BASE%/v1/results/save -H "Content-Type: application/json" -d "{\"user_id\":\"%USER%\",\"match\":{\"match_score\":30},\"report\":{\"radar\":{\"hard\":30}},\"file\":{\"file_id\":\"x.pdf\",\"bytes\":12345}}" & echo.

echo === results.db(list) ===
curl -s "%BASE%/v1/results/db?user_id=%USER%" & echo.

echo === DONE ===
endlocal
