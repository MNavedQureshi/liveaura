#!/bin/bash
# setup-vps.sh
# Run once on a fresh Ubuntu 22.04 / Debian 12 VPS as root.
# Usage: bash setup-vps.sh

set -e

echo "==> Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin

# Add current user to docker group (if not root)
if [ "$USER" != "root" ]; then
  usermod -aG docker "$USER"
  echo "  Added $USER to docker group. Re-login or run: newgrp docker"
fi

echo "==> Configuring firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# SSH — adjust port if you changed it
ufw allow 22/tcp

# HTTP/HTTPS for Caddy + HTTP/3 QUIC
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp

# WebRTC TCP (fallback transport)
ufw allow 7881/tcp

# WebRTC UDP — primary media path (must be open!)
ufw allow 7882/udp

# TURN server (helps clients behind NAT/corporate firewalls)
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp

ufw --force enable
echo "  Firewall enabled."

echo "==> Tuning kernel network settings for WebRTC..."
cat >> /etc/sysctl.conf <<'EOF'
# LiveKit / WebRTC tuning
net.core.rmem_max=2500000
net.core.wmem_max=2500000
net.core.netdev_max_backlog=5000
EOF
sysctl -p

echo ""
echo "=========================================="
echo " VPS setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Point these DNS A records to $(curl -s ifconfig.me 2>/dev/null || echo '<this VPS IP>'):"
echo "       livekit.yourdomain.com"
echo "       app.yourdomain.com"
echo "       api.yourdomain.com"
echo ""
echo "  2. Upload or clone the project to this server."
echo ""
echo "  3. Copy .env.example to .env and fill in your values:"
echo "       cp .env.example .env && nano .env"
echo ""
echo "  4. Start everything:"
echo "       docker compose up -d --build"
echo ""
echo "  5. Check logs:"
echo "       docker compose logs -f"
echo ""
