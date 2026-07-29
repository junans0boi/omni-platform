#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Omni-Platform — Caddy Web Server + Automatic HTTPS Setup Script
# Usage: bash setup-caddy.sh [domain_or_ip]
# Example: bash setup-caddy.sh myomni.com
# Example (IP/Tailscale): bash setup-caddy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

DOMAIN=$1

echo "▶ [1/3] Installing Caddy Web Server..."
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg || true
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list || true
sudo apt update
sudo apt install -y caddy

echo "▶ [2/3] Configuring Caddyfile..."
TARGET_DOMAIN="${DOMAIN:-omni.steady2vivid.kro.kr}"

# This server hosts multiple apps behind one shared Caddy instance. Writing
# our block straight into /etc/caddy/Caddyfile would clobber every other
# site's config on each deploy (and vice versa when another app's setup
# script runs). Instead, own a single snippet file under sites/ and make
# sure the main Caddyfile imports the directory — never touch the rest of it.
sudo mkdir -p /etc/caddy/sites

if [ -f /etc/caddy/Caddyfile ] && ! grep -q "^import sites/\*\.caddy" /etc/caddy/Caddyfile; then
  echo "import sites/*.caddy" | sudo tee -a /etc/caddy/Caddyfile > /dev/null
elif [ ! -f /etc/caddy/Caddyfile ]; then
  echo "import sites/*.caddy" | sudo tee /etc/caddy/Caddyfile > /dev/null
fi

sudo tee /etc/caddy/sites/omni-platform.caddy > /dev/null <<EOF
$TARGET_DOMAIN {
    encode zstd gzip

    # Proxy WebSocket & HTTP requests to Next.js App (see ecosystem.config.js PORT)
    reverse_proxy localhost:3001 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF

echo "▶ [3/3] Opening firewall ports (80/443)..."
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || true

echo "▶ Reloading Caddy service..."
# reload (not restart) so other sites sharing this Caddy instance don't drop.
sudo systemctl enable caddy
if systemctl is-active --quiet caddy; then
  sudo systemctl reload caddy
else
  sudo systemctl start caddy
fi

echo ""
echo "════════════════════════════════════════"
echo "  ✅ Caddy Setup Complete!"
if [ -n "$DOMAIN" ]; then
  echo "  Site is live at: https://$DOMAIN"
else
  echo "  Site is live at: http://localhost (Port 80 -> 3001)"
fi
echo "════════════════════════════════════════"
