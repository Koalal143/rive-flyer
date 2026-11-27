#!/bin/sh
set -eu

domain=${SITE_DOMAIN:-}
case "$domain" in
    *[!a-z0-9.-]*)
        echo 'SITE_DOMAIN must be a lowercase DNS name without a URL scheme, path or port.' >&2
        exit 1
        ;;
esac
if [ -n "$domain" ] && ! printf '%s\n' "$domain" |
    grep -Eq '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'; then
    echo 'SITE_DOMAIN must be a lowercase DNS name without a URL scheme, path or port.' >&2
    exit 1
fi

certificate_dir="/etc/letsencrypt/live/$domain"
config=/etc/nginx/conf.d/default.conf

certificate_version() {
    if [ -n "$domain" ] && [ -s "$certificate_dir/fullchain.pem" ] && [ -s "$certificate_dir/privkey.pem" ]; then
        stat -L -c '%d:%i:%Y:%s' "$certificate_dir/fullchain.pem" "$certificate_dir/privkey.pem" 2>/dev/null || true
    fi
}

write_config() {
    cat <<'NGINX'
server_tokens off;

map $uri $site_cache_control {
    default "no-cache";
    ~^/assets/ "public, max-age=31536000, immutable";
    ~^/api/ "no-store";
    ~^/admin/ "no-store";
    ~^/gift/ "no-store";
    ~^/grafana/ "";
}

map $http_upgrade $grafana_connection {
    default upgrade;
    '' close;
}

server {
    listen 80 default_server;
    server_name _;

    location = /_nginx_health {
        access_log off;
        return 204;
    }

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type text/plain;
        try_files $uri =404;
    }
NGINX

    if [ -z "$1" ]; then
        printf '    include /opt/rivegauche/nginx/production.conf;\n}\n'
        return
    fi

    cat <<NGINX
    location / {
        return 308 https://$domain\$request_uri;
    }
}

server {
    listen 443 ssl default_server;
    server_name $domain;
    ssl_certificate $certificate_dir/fullchain.pem;
    ssl_certificate_key $certificate_dir/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    include /opt/rivegauche/nginx/production.conf;
}
NGINX
}

version=$(certificate_version)
write_config "$version" > "$config"
nginx -t

if [ -n "$domain" ]; then
    # Certbot updates the shared certificate files when it issues or renews.
    (
        while sleep 5; do
            current=$(certificate_version)
            if [ -n "$current" ] && [ "$current" != "$version" ]; then
                cp "$config" "$config.previous"
                write_config "$current" > "$config.next"
                mv "$config.next" "$config"
                if nginx -t && nginx -s reload; then
                    version=$current
                    rm -f "$config.previous"
                else
                    mv "$config.previous" "$config"
                fi
            fi
        done
    ) &
fi

exec nginx -g 'daemon off;'
