#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Omni-Platform — Oracle Cloud Ubuntu Server 배포 스크립트
# Ubuntu 22.04 LTS (ARM64 or x86) 기준
# 실행: bash deploy.sh [your-domain.com]
# 예시: bash deploy.sh myomni.com
#
# Issue #105: Nginx 제거 → Caddy + Let's Encrypt 기반으로 변경
# ─────────────────────────────────────────────────────────────────────────────

set -e  # 에러 발생 시 즉시 중단

DOMAIN=${1:-""}

echo "════════════════════════════════════════"
echo "  Omni-Platform Deployment Script"
echo "  Proxy: Caddy + Let's Encrypt HTTPS"
echo "════════════════════════════════════════"

# ── 1. 시스템 패키지 업데이트 ──────────────────────────────────────────────
echo "▶ [1/8] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# ── 2. Node.js 22 설치 (NVM 사용) ─────────────────────────────────────────
echo "▶ [2/8] Installing Node.js 22 via NVM..."
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 22
nvm use 22
nvm alias default 22

echo "Node version: $(node -v)"
echo "NPM  version: $(npm -v)"

# ── 3. PM2 글로벌 설치 ────────────────────────────────────────────────────
echo "▶ [3/8] Installing PM2..."
npm install -g pm2

# ── 4. Caddy 설치 (Nginx 대체) ───────────────────────────────────────────────
# Issue #105: Nginx 제거, Caddy + Let's Encrypt 자동 HTTPS 인증서 사용
echo "▶ [4/8] Installing Caddy Web Server..."
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list 2>/dev/null || true
sudo apt update
sudo apt install -y caddy

# Caddyfile 작성
TARGET_DOMAIN="${DOMAIN:-omni.steady2vivid.kro.kr}"

echo "▶ Configuring Caddyfile for domain: $TARGET_DOMAIN"
sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
${TARGET_DOMAIN} {
    # Let's Encrypt HTTPS 자동 발급/갱신 (도메인 사용 시)
    encode zstd gzip

    # WebSocket & HTTP → Next.js 3000 포트 프록시
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        # WebSocket 지원
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection {http.request.header.Connection}
    }
}
EOF

# 방화벽 포트 개방 (80/443)
echo "▶ Opening firewall ports 80 and 443..."
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || true

# Caddy 서비스 시작/활성화
sudo systemctl enable caddy
sudo systemctl restart caddy

# ── 5. 코드 클론 또는 업데이트 ────────────────────────────────────────────
echo "▶ [5/8] Cloning / updating repository..."
APP_DIR="$HOME/omni-platform"

if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  git clone https://github.com/junans0boi/omni-platform.git "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 6. 패키지 설치 및 DB 초기화 ───────────────────────────────────────────
echo "▶ [6/8] Installing dependencies..."
npm ci --production=false

echo "▶ Initializing SQLite database..."
mkdir -p logs
npx prisma db push

# ── 7. 프로덕션 빌드 ─────────────────────────────────────────────────────
echo "▶ [7/8] Building Next.js production bundle..."
npm run build

# ── 8. PM2로 서비스 시작 ─────────────────────────────────────────────────
echo "▶ [8/8] Starting service with PM2..."
pm2 stop omni-platform 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | sudo bash -  # 재부팅 후 자동 시작 등록

echo ""
echo "════════════════════════════════════════"
echo "  ✅ Deployment complete!"
if [ -n "$DOMAIN" ]; then
  echo "  Site is live at: https://$DOMAIN"
  echo "  HTTPS certificate: Let's Encrypt (auto-renewal via Caddy)"
else
  echo "  Domain not specified. Using: http://$TARGET_DOMAIN"
  echo "  Run: bash deploy.sh <your-domain.com>"
fi
echo "  App is running on port 3000 (via PM2)"
echo "  Caddy proxies: 80/443 → 3000"
echo "════════════════════════════════════════"
