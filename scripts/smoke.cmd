@echo off
set BASE=http://localhost:8080

rem 执行数据库连接检查
echo === db.ping ===
curl -s %BASE%/v1/db/ping
echo.

echo === DONE ===
