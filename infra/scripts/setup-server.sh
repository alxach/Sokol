#!/bin/bash
set -euo pipefail

echo "=== SOKOL Server Setup ==="

# --- System update ---
apt update && apt upgrade -y

# --- Install essentials ---
apt install -y \
    curl wget git vim htop net-tools \
    apt-transport-https ca-certificates gnupg lsb-release \
    ufw

# --- Install Docker ---
if ! command -v docker &>/dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
fi

# --- Install Docker Compose plugin ---
if ! command -v docker-compose &>/dev/null; then
    echo "Installing Docker Compose..."
    curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# --- Create app user ---
if ! id -u sokol &>/dev/null; then
    useradd -m -s /bin/bash sokol
    usermod -aG docker sokol
fi

# --- Firewall ---
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# --- Create app directory ---
mkdir -p /opt/sokol
chown sokol:sokol /opt/sokol

# --- Install certbot for SSL ---
apt install -y certbot python3-certbot-nginx

echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Clone repo to /opt/sokol"
echo "  2. Copy .env.example to .env and fill secrets"
echo "  3. Run: docker-compose -f infra/docker-compose.yml up -d"
echo "  4. Run: certbot --nginx -d your-domain.com"
