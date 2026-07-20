#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Nginx + HTTPS (Let's Encrypt) 설정 스크립트
# 사전 조건: deploy.sh 실행 완료 후, 도메인 DNS가 이 서버 IP를 가리키고 있어야 함
# 실행: bash setup-nginx.sh yourdomain.com
# ─────────────────────────────────────────────────────────────────────────────

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
  echo "Usage: bash setup-nginx.sh yourdomain.com"
  exit 1
fi

echo "▶ Setting up Nginx for domain: $DOMAIN"

# Nginx 설정 파일 생성
sudo tee /etc/nginx/sites-available/omni-platform > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
    }

    # SSE (Server-Sent Events) - disable buffering
    location /api/channels/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding on;
    }
}
EOF

# 심볼릭 링크 설정 및 기본 설정 제거
sudo ln -sf /etc/nginx/sites-available/omni-platform /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "▶ Installing Certbot for HTTPS..."
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect

echo ""
echo "════════════════════════════════════════"
echo "  ✅ HTTPS setup complete!"
echo "  Site is live at: https://$DOMAIN"
echo "════════════════════════════════════════"
