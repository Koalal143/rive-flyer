#!/bin/sh
set -eu

: "${SITE_DOMAIN:?Set SITE_DOMAIN in .env.prod}"
: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in .env.prod}"

until certbot certonly --non-interactive --agree-tos --keep-until-expiring \
    --webroot --webroot-path /var/www/certbot --email "$CERTBOT_EMAIL" \
    --cert-name "$SITE_DOMAIN" --domain "$SITE_DOMAIN"; do
    echo 'Certificate issuance failed. Retrying in one hour.' >&2
    sleep 3600
done

while sleep 43200; do
    certbot renew --non-interactive --cert-name "$SITE_DOMAIN" ||
        echo 'Certificate renewal failed. See Certbot logs for details.' >&2
done
