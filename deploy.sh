#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Omni-Platform — Oracle Cloud Ubuntu Server 배포 스크립트
# Ubuntu 22.04 LTS (ARM64 or x86) 기준
# 실행: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e  # 에러 발생 시 즉시 중단

echo "════════════════════════════════════════"
echo "  Omni-Platform Deployment Script"
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

# ── 4. Nginx 설치 ─────────────────────────────────────────────────────────
echo "▶ [4/8] Installing Nginx..."
sudo apt install -y nginx

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
echo "  App is running on: http://$(curl -s ifconfig.me):3000"
echo "════════════════════════════════════════"
