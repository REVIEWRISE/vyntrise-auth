#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# init-ssl.sh — Run this ONCE on the server to issue the initial SSL certificate
#
# Prerequisites:
#   1. DNS A record for auth.vyntrise.com → 67.217.241.41 must be live
#   2. Port 80 must be open on the server firewall
#   3. docker and docker compose must be installed
#   4. Run from the /vyntrise-auth directory: bash scripts/init-ssl.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

DOMAIN="auth.vyntrise.com"
EMAIL="admin@vyntrise.com"   # Change to your real email for expiry alerts
NGINX_CONF_DIR="./nginx"

echo "▶ [1/5] Switching Nginx to HTTP-only mode for ACME challenge..."
cp "$NGINX_CONF_DIR/auth.vyntrise.com.http-only.conf" \
   "$NGINX_CONF_DIR/auth.vyntrise.com.conf"

echo "▶ [2/5] Bringing up all services (HTTP-only)..."
docker compose up -d

echo "▶ [3/5] Requesting Let's Encrypt certificate for $DOMAIN..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo "▶ [4/5] Restoring HTTPS Nginx config..."
cat > "$NGINX_CONF_DIR/auth.vyntrise.com.conf" << 'NGINXCONF'
server {
    listen 80;
    server_name auth.vyntrise.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name auth.vyntrise.com;

    ssl_certificate     /etc/letsencrypt/live/auth.vyntrise.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/auth.vyntrise.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header X-Frame-Options        "SAMEORIGIN"    always;
    add_header X-Content-Type-Options "nosniff"       always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass         http://frontend:3002;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass         http://backend:3010/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
NGINXCONF

echo "▶ [5/5] Reloading Nginx with HTTPS config..."
docker compose exec nginx nginx -s reload

echo ""
echo "✅ Done! https://$DOMAIN is now live with SSL."
echo "   Certbot will auto-renew your certificate every 12 hours."
