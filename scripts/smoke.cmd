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

:: ---- 订单：创建 -> 回调为已支付 -> 查询状态（用 PowerShell 处理 JSON）----
echo === order.create / callback / status ===
powershell -Command "$r = irm '%BASE%/v1/order/create' -Method Post -ContentType 'application/json' -Body '{\"plan\":\"basic\",\"amount\":1990}'; $otn = $r.data.out_trade_no; Write-Host ('out_trade_no=' + $otn); $cb = irm '%BASE%/v1/order/callback' -Method Post -ContentType 'application/json' -Body (@{ out_trade_no = $otn; result = 'SUCCESS'; amount = 1990 } | ConvertTo-Json); $cb | ConvertTo-Json -Compress | Out-Host; $st = irm ('%BASE%/v1/order/status?out_trade_no=' + $otn); $st | ConvertTo-Json -Compress | Out-Host"

:: ---- PDF 渲染（用 PowerShell 发送规范 JSON，避免转义问题）----
echo === render.pdf ===
powershell -Command "$j = @{ html = '<div style=\"font-size:24px\">Smoke Test PDF</div>' } | ConvertTo-Json -Compress; irm '%BASE%/v1/render/pdf' -Method Post -ContentType 'application/json' -Body $j | ConvertTo-Json -Compress | Out-Host"

echo === render.resume ===
curl -s -X POST %BASE%/v1/render/resume -H "Content-Type: application/json" -d "{\"templateId\":\"classic\"}" & echo.

echo === results.save(DB) ===
curl -s -X POST %BASE%/v1/results/save -H "Content-Type: application/json" -d "{\"user_id\":\"%USER%\",\"match\":{\"match_score\":30},\"report\":{\"radar\":{\"hard\":30}},\"file\":{\"file_id\":\"x.pdf\",\"bytes\":12345}}" & echo.

echo === results.db(list) ===
curl -s "%BASE%/v1/results/db?user_id=%USER%" & echo.

echo === DONE ===
endlocal
