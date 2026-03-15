#!/bin/bash
set -e
PROJ_DIR="/www/wwwroot/openstory.devokai.com/openstory"
APP="openstory-backend"

echo "=== [1/3] Building backend ==="
cd "$PROJ_DIR/platform/backend"
npm run build

echo "=== [2/3] Building frontend ==="
sudo -u devuser bash -c "cd $PROJ_DIR/platform/frontend && npm run build"

echo "=== [3/3] Reloading pm2 (zero-downtime) ==="
# --update-env 让 pm2 重新读取环境变量
sudo -u devuser pm2 reload "$APP" --update-env

# 等待进程稳定，确认没有立即崩溃
sleep 2
STATUS=$(sudo -u devuser pm2 jlist | python3 -c "
import sys, json
procs = json.load(sys.stdin)
for p in procs:
    if p['name'] == '$APP':
        print(p['pm2_env']['status'])
" 2>/dev/null)

if [ "$STATUS" = "online" ]; then
    echo "=== Done — $APP is online ==="
else
    echo "!!! $APP status=$STATUS, check logs:" >&2
    sudo -u devuser pm2 logs "$APP" --lines 30 --nostream
    exit 1
fi

sudo -u devuser pm2 list
