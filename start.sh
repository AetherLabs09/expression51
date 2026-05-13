#!/bin/sh

cd /app/backend
node src/server.js &

sleep 2

echo "服务器已启动，访问 http://localhost:3000"
echo "前端静态文件位于 /app/frontend"
echo "数据库位于 /app/db"

wait
