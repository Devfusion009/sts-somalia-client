#!/usr/bin/env bash
# One-time server setup. Run as root (or with sudo) on Ubuntu 24.04:
#   sudo bash bootstrap.sh "<deploy public key>"
# Idempotent: safe to run again.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_KEY="${1:?usage: bootstrap.sh \"<ssh public key for the deploy user>\"}"
APP_DIR="/opt/sts"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl ufw fail2ban unattended-upgrades

# Docker engine from Docker's apt repository.
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

# Deploy user: key-only login, docker group, no sudo.
id -u "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
grep -qxF "$DEPLOY_KEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null \
  || echo "$DEPLOY_KEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"

# Swap: 2 GB on a 3.8 GB box absorbs spikes during image pulls.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Firewall: SSH, HTTP, HTTPS only. Compose publishes nothing else.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# SSH hardening is opt-in: HARDEN_SSH=1 disables password login and root login.
# Confirm key login works in a second session first.
if [ "${HARDEN_SSH:-0}" = "1" ]; then
  cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'CONF'
PasswordAuthentication no
PermitRootLogin no
CONF
  systemctl reload ssh
fi

systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "Bootstrap complete. Deploy user: $DEPLOY_USER, app dir: $APP_DIR"
